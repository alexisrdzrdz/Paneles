'use server';

import { z } from 'zod';
import { and, eq, ne, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { quotes, quoteEvents, users, payments } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { STATUS, money, parsePesosToCents } from '@/lib/quotes';
import { estadoMail, decisionAdminMail, pagoClienteMail, pagoValidadoMail } from '@/lib/mail';

export type GestionState = { error?: string; ok?: string };

const cambioSchema = z.object({
  quoteId: z.string().uuid(),
  estado: z.enum([
    'submitted', 'reviewing', 'quoted', 'approved',
    'in_production', 'shipped', 'delivered', 'cancelled',
  ]),
  mensaje: z.string().trim().max(1000).optional(),
  /* Total en firme en pesos, opcional: al pasar a "Cotizado" el staff puede
     ajustar el número del tabulador con su criterio. */
  total: z.string().trim().max(20).optional(),
});

export async function cambiarEstado(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!isAdmin(user)) return { error: 'No autorizado' };

  const parsed = cambioSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Revisa los datos del cambio.' };
  const { quoteId, estado, mensaje, total } = parsed.data;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote) return { error: 'Esa cotización no existe.' };

  let totalCents: number | undefined;
  if (total) {
    const n = Number(total.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) return { error: 'El total en firme no se entiende. Escribe solo el número.' };
    totalCents = Math.round(n * 100);
  }

  const cambia = estado !== quote.status;
  if (!cambia && !mensaje && totalCents === undefined) {
    return { error: 'No hay nada que cambiar: mismo estado, sin mensaje y sin total.' };
  }

  await db.transaction(async (tx) => {
    await tx.update(quotes).set({
      status: estado,
      ...(totalCents !== undefined ? { totalCents } : {}),
      updatedAt: new Date(),
    }).where(eq(quotes.id, quoteId));

    await tx.insert(quoteEvents).values({
      quoteId,
      type: cambia ? 'status_changed' : 'note',
      fromStatus: cambia ? quote.status : null,
      toStatus: cambia ? estado : null,
      message: mensaje || (totalCents !== undefined && !cambia ? `Total actualizado a ${money(totalCents, quote.currency)}.` : null),
      actorId: user!.id,
      visibleToCustomer: true,
    });
  });

  /* El aviso al cliente sale del ciclo crítico: si el correo falla, el cambio
     ya quedó hecho y visible en su portal. */
  if (cambia) {
    try {
      const owner = await db.query.users.findFirst({ where: eq(users.id, quote.userId) });
      if (owner) {
        const s = STATUS[estado];
        await estadoMail(owner.email, owner.name, quote.reference, s.label, s.hint, mensaje || null, `/portal/${quoteId}`);
      }
    } catch (err) {
      console.error('Correo de estado no enviado:', err);
    }
  }

  revalidatePath(`/portal/${quoteId}`);
  revalidatePath('/portal');
  revalidatePath('/admin/solicitudes');
  return { ok: cambia ? `Ahora está en “${STATUS[estado].label}”. El cliente lo verá en su portal.` : 'Guardado.' };
}

/* ── La decisión del cliente ───────────────────────────────────────────
   Cuando hay precio en firme, el dueño del proyecto decide desde su portal:
   aprueba o no continúa. Es SU proyecto: no exige rol, exige pertenencia. */
const decisionSchema = z.object({
  quoteId: z.string().uuid(),
  decision: z.enum(['approved', 'cancelled']),
});

export async function decidir(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!user) return { error: 'Tu sesión caducó. Vuelve a entrar.' };

  const parsed = decisionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'No se entendió la decisión.' };
  const { quoteId, decision } = parsed.data;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote || quote.userId !== user.id) return { error: 'Ese proyecto no existe.' };
  if (quote.status !== 'quoted') {
    return { error: 'Este proyecto no está esperando tu decisión ahora mismo.' };
  }

  const aprobado = decision === 'approved';
  await db.transaction(async (tx) => {
    await tx.update(quotes).set({ status: decision, updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));
    await tx.insert(quoteEvents).values({
      quoteId,
      type: 'status_changed',
      fromStatus: 'quoted',
      toStatus: decision,
      message: aprobado ? 'El cliente aprobó la cotización.' : 'El cliente decidió no continuar.',
      actorId: user.id,
      visibleToCustomer: true,
    });
  });

  try {
    const staff = await db.query.users.findMany({ where: ne(users.role, 'customer') });
    for (const s of staff) {
      await decisionAdminMail(s.email, s.name, quote.reference, user.name, aprobado, `/portal/${quoteId}`);
    }
  } catch (err) {
    console.error('Correo de decisión no enviado:', err);
  }

  revalidatePath(`/portal/${quoteId}`);
  revalidatePath('/portal');
  revalidatePath('/admin/solicitudes');
  return { ok: aprobado
    ? '¡Gracias! Tu aprobación quedó registrada; el equipo prepara la fabricación.'
    : 'Registrado. El proyecto queda cancelado; puedes cotizar otro cuando quieras.' };
}

/* ── Dirección de envío ────────────────────────────────────────────────
   La captura el dueño (o el staff) y viaja con el pedido. Editable hasta que
   el pedido sale: después de enviado, cambiarla ya no cambia nada. */
const direccionSchema = z.object({
  quoteId: z.string().uuid(),
  calle: z.string().trim().min(3, 'Escribe calle y número').max(160),
  colonia: z.string().trim().max(120).optional(),
  ciudad: z.string().trim().min(2, 'Falta la ciudad').max(120),
  estado: z.string().trim().min(2, 'Falta el estado').max(80),
  cp: z.string().trim().regex(/^\d{5}$/, 'El código postal son 5 dígitos'),
  contacto: z.string().trim().max(120).optional(),
  telefono: z.string().trim().max(40).optional(),
  notas: z.string().trim().max(300).optional(),
});

export type Direccion = Omit<z.infer<typeof direccionSchema>, 'quoteId'>;

export async function guardarDireccion(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!user) return { error: 'Tu sesión caducó. Vuelve a entrar.' };

  const parsed = direccionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { quoteId, ...direccion } = parsed.data;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote || (quote.userId !== user.id && !isAdmin(user))) return { error: 'Ese proyecto no existe.' };
  if (['shipped', 'delivered', 'cancelled'].includes(quote.status)) {
    return { error: 'Este pedido ya salió; para cambios de entrega contáctanos directo.' };
  }

  await db.transaction(async (tx) => {
    await tx.update(quotes).set({ shipping: direccion, updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));
    await tx.insert(quoteEvents).values({
      quoteId, type: 'note',
      message: `Dirección de envío ${quote.shipping ? 'actualizada' : 'capturada'}: ${direccion.calle}, ${direccion.ciudad}.`,
      actorId: user.id, visibleToCustomer: true,
    });
  });

  revalidatePath(`/portal/${quoteId}`);
  return { ok: 'Dirección guardada.' };
}

/* ── Conversación dentro del sistema ───────────────────────────────────
   El cliente y el vendedor hablan aquí, no por correo: cada mensaje es un
   evento de la bitácora, visible para ambos en el detalle del proyecto.
   Escribe el dueño del proyecto o el staff; nadie más. */
const mensajeSchema = z.object({
  quoteId: z.string().uuid(),
  texto: z.string().trim().min(1, 'Escribe un mensaje').max(2000),
});

export async function enviarMensaje(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!user) return { error: 'Tu sesión caducó. Vuelve a entrar.' };

  const parsed = mensajeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { quoteId, texto } = parsed.data;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote || (quote.userId !== user.id && !isAdmin(user))) {
    return { error: 'Ese proyecto no existe.' };
  }

  await db.insert(quoteEvents).values({
    quoteId, type: 'note', message: texto, actorId: user.id, visibleToCustomer: true,
  });

  revalidatePath(`/portal/${quoteId}`);
  revalidatePath('/admin/solicitudes');
  return { ok: 'enviado' };
}

/* ── Pagos ─────────────────────────────────────────────────────────────
   Solo el staff registra pagos (esto NO es una pasarela: es el registro de
   lo que ya llegó al banco). Append-only; un error se corrige con un pago
   negativo visible, no borrando historia. */
const pagoSchema = z.object({
  quoteId: z.string().uuid(),
  monto: z.string().trim().min(1, 'Falta el monto'),
  metodo: z.enum(['transferencia', 'deposito', 'efectivo', 'tarjeta', 'otro']),
  referencia: z.string().trim().max(80).optional(),
  nota: z.string().trim().max(300).optional(),
});

export async function registrarPago(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!isAdmin(user)) return { error: 'No autorizado' };

  const parsed = pagoSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { quoteId, monto, metodo, referencia, nota } = parsed.data;

  const amountCents = parsePesosToCents(monto);
  if (amountCents === null) return { error: 'El monto no se entiende. Escribe solo el número (p. ej. 20000).' };

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote) return { error: 'Esa cotización no existe.' };

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      quoteId, amountCents, method: metodo,
      reference: referencia || null, note: nota || null,
      createdBy: user!.id,
    });
    await tx.insert(quoteEvents).values({
      quoteId, type: 'note',
      message: `Pago registrado: ${money(amountCents, quote.currency)} (${metodo}${referencia ? ` ${referencia}` : ''}).`,
      actorId: user!.id, visibleToCustomer: true,
    });
  });

  /* Saldo después de este pago, para el recibo. Solo lo confirmado abona. */
  const [{ pagado }] = await db.select({ pagado: sum(payments.amountCents) })
    .from(payments)
    .where(and(eq(payments.quoteId, quoteId), eq(payments.status, 'confirmado')));
  const saldo = quote.totalCents - Number(pagado ?? 0);

  try {
    const owner = await db.query.users.findFirst({ where: eq(users.id, quote.userId) });
    if (owner) {
      await pagoClienteMail(owner.email, owner.name, quote.reference,
        money(amountCents, quote.currency), money(Math.max(0, saldo), quote.currency), `/portal/${quoteId}`);
    }
  } catch (err) {
    console.error('Correo de pago no enviado:', err);
  }

  revalidatePath(`/portal/${quoteId}`);
  return { ok: `Pago de ${money(amountCents, quote.currency)} registrado. Saldo: ${money(Math.max(0, saldo), quote.currency)}.` };
}

/* ── Validar un pago reportado ─────────────────────────────────────────
   El cliente subió su comprobante; el staff lo coteja contra el banco y lo
   confirma o lo regresa con motivo. Solo pagos pendientes se validan. */
const validarSchema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(['confirmado', 'rechazado']),
  /* Se recorta en vez de rechazar: un motivo largo no debe tumbar la
     validación con un error genérico. */
  nota: z.string().trim().transform((s) => s.slice(0, 300) || undefined).optional(),
});

export async function validarPago(_prev: GestionState, form: FormData): Promise<GestionState> {
  const user = await currentUser();
  if (!isAdmin(user)) return { error: 'No autorizado' };

  const parsed = validarSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Revisa los datos de la validación.' };
  const { paymentId, decision, nota } = parsed.data;

  const pago = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!pago) return { error: 'Ese pago no existe.' };
  if (pago.status !== 'pendiente') return { error: 'Ese pago ya fue validado.' };

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, pago.quoteId) });
  if (!quote) return { error: 'El proyecto de ese pago ya no existe.' };

  const montoTxt = money(pago.amountCents, quote.currency);
  /* El UPDATE exige que SIGA pendiente: si otro miembro del staff lo validó
     entre la lectura y aquí, afecta cero filas y se aborta — nada de dos
     correos contradictorios ni doble evento en la bitácora. */
  const validado = await db.transaction(async (tx) => {
    const filas = await tx.update(payments)
      .set({ status: decision, note: nota ? `${pago.note ? pago.note + ' · ' : ''}${nota}` : pago.note })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pendiente')))
      .returning({ id: payments.id });
    if (!filas.length) return false;
    await tx.insert(quoteEvents).values({
      quoteId: pago.quoteId, type: 'note',
      message: decision === 'confirmado'
        ? `Pago de ${montoTxt} confirmado.`
        : `Pago de ${montoTxt} no validado.${nota ? ` Motivo: ${nota}` : ''}`,
      actorId: user!.id, visibleToCustomer: true,
    });
    return true;
  });
  if (!validado) return { error: 'Ese pago acaba de ser validado por alguien más.' };

  const [{ pagado }] = await db.select({ pagado: sum(payments.amountCents) })
    .from(payments)
    .where(and(eq(payments.quoteId, pago.quoteId), eq(payments.status, 'confirmado')));
  const saldo = Math.max(0, quote.totalCents - Number(pagado ?? 0));

  try {
    const owner = await db.query.users.findFirst({ where: eq(users.id, quote.userId) });
    if (owner) {
      await pagoValidadoMail(owner.email, owner.name, quote.reference, montoTxt,
        decision === 'confirmado', nota || null, money(saldo, quote.currency), `/portal/${quote.id}`);
    }
  } catch (err) {
    console.error('Correo de validación no enviado:', err);
  }

  revalidatePath(`/portal/${quote.id}`);
  revalidatePath('/admin/solicitudes');
  return { ok: decision === 'confirmado'
    ? `Pago confirmado. Saldo: ${money(saldo, quote.currency)}.`
    : 'Pago marcado como no validado; se le avisó al cliente.' };
}
