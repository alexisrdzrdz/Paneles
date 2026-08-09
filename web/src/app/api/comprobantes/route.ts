import { NextResponse } from 'next/server';
import { and, eq, ne, sum } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, payments, paymentReceipts, quoteEvents, users } from '@/db/schema';
import { currentUser, rateLimit } from '@/lib/auth';
import { money } from '@/lib/quotes';
import { pagoReportadoAdminMail } from '@/lib/mail';

/* El cliente reporta su transferencia: monto + comprobante (imagen o PDF).
   Nace PENDIENTE y no abona al saldo hasta que el staff la valida contra el
   banco. Nada de pasarelas: la cuenta es directa y la confianza la pone la
   validación humana. */

const MAX_BYTES = 4 * 1024 * 1024;   // 4 MB: una foto de ticket sobra
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
/* Estados en los que tiene sentido pagar: ya hay compromiso del cliente. */
const PAGABLES = new Set(['approved', 'in_production', 'shipped', 'delivered']);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Necesitas entrar a tu cuenta' }, { status: 401 });

  if (!(await rateLimit(`comprobante:usuario:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: 'Demasiados intentos seguidos. Espera unos minutos.' }, { status: 429 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 });
  }

  const quoteId = String(form.get('quoteId') ?? '');
  const referencia = String(form.get('referencia') ?? '').trim().slice(0, 80);
  const nota = String(form.get('nota') ?? '').trim().slice(0, 300);
  const monto = Number(String(form.get('monto') ?? '').replace(/[$,\s]/g, ''));
  const archivo = form.get('archivo');

  if (!/^[0-9a-f-]{36}$/.test(quoteId)) return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'Escribe el monto transferido (solo el número).' }, { status: 400 });
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: 'Adjunta tu comprobante (foto o PDF).' }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo pasa de 4 MB. Sube una foto más ligera.' }, { status: 400 });
  }
  if (!MIMES.has(archivo.type)) {
    return NextResponse.json({ error: 'Solo se aceptan JPG, PNG, WebP o PDF.' }, { status: 400 });
  }

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  if (!quote || quote.userId !== user.id) return NextResponse.json({ error: 'Ese proyecto no existe' }, { status: 404 });
  if (!PAGABLES.has(quote.status)) {
    return NextResponse.json({ error: 'Este proyecto aún no está en etapa de pago.' }, { status: 400 });
  }

  const amountCents = Math.round(monto * 100);
  const data = Buffer.from(await archivo.arrayBuffer());

  const pago = await db.transaction(async (tx) => {
    const [p] = await tx.insert(payments).values({
      quoteId, amountCents,
      method: 'transferencia', status: 'pendiente',
      reference: referencia || null, note: nota || null,
      createdBy: user.id,
    }).returning();
    await tx.insert(paymentReceipts).values({
      paymentId: p.id, data, mime: archivo.type,
      filename: archivo.name.slice(0, 140) || 'comprobante', size: archivo.size,
    });
    await tx.insert(quoteEvents).values({
      quoteId, type: 'note',
      message: `El cliente reportó un pago de ${money(amountCents, quote.currency)} y subió su comprobante. Pendiente de validar.`,
      actorId: user.id, visibleToCustomer: true,
    });
    return p;
  });

  try {
    const [{ pagado }] = await db.select({ pagado: sum(payments.amountCents) }).from(payments)
      .where(and(eq(payments.quoteId, quoteId), eq(payments.status, 'confirmado')));
    const saldo = Math.max(0, quote.totalCents - Number(pagado ?? 0));
    const staff = await db.query.users.findMany({ where: ne(users.role, 'customer') });
    for (const s of staff) {
      await pagoReportadoAdminMail(s.email, s.name, quote.reference, user.name,
        money(amountCents, quote.currency), money(saldo, quote.currency), `/portal/${quoteId}`);
    }
  } catch (err) {
    console.error('Correo de pago reportado no enviado:', err);
  }

  return NextResponse.json({ ok: true, id: pago.id });
}
