import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, quoteLines, quoteEvents, users } from '@/db/schema';
import { currentUser, rateLimit } from '@/lib/auth';
import { sameOrigin } from '@/lib/http';
import { proyectoSchema, cotizar, cuentaUnidades, sinEnvioCents } from '@/lib/cotizacion';
import { money } from '@/lib/quotes';
import { solicitudClienteMail, solicitudAdminMail } from '@/lib/mail';

/* Convierte lo armado en el cotizador en una solicitud real: folio, desglose
   con los precios DEL DÍA materializado línea por línea, bitácora y correos.
   El total se recalcula aquí; el que calculó el navegador no se le cree. */

/* Un baño del proyecto: su diseño y cuántas veces se repite (pisos iguales).
   El nombre se recorta en vez de rechazar: un nombre largo no debe tumbar
   todo el envío. */
const banoSchema = z.object({
  proyecto: proyectoSchema,
  repeticiones: z.number().int().min(1).max(500).catch(1),
  nombre: z.string().trim().transform((s) => s.slice(0, 60) || undefined).optional().catch(undefined),
});

const bodySchema = z.object({
  /* Un proyecto puede llevar VARIOS baños distintos (planta baja de 8 + pisos
     tipo de 4…). Cada uno con su diseño y su multiplicador. */
  banos: z.array(banoSchema).min(1).max(30).optional(),
  /* Compatibilidad con el envío de un solo baño. */
  proyecto: proyectoSchema.optional(),
  repeticiones: z.number().int().min(1).max(500).catch(1),
  nombre: z.string().trim().min(1).max(120).catch('Baño'),
  zip: z.string().trim().max(10).optional(),
  /* Estado íntegro del configurador, para poder reabrir el proyecto tal cual
     se dejó. Opaco a propósito: el servidor no lo interpreta, solo lo guarda. */
  estado: z.unknown().optional(),
}).refine((d) => (d.banos && d.banos.length > 0) || d.proyecto, {
  message: 'Falta el proyecto',
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Necesitas entrar a tu cuenta' }, { status: 401 });
  }

  const text = await req.text();
  if (text.length > 300_000) {
    return NextResponse.json({ error: 'Proyecto demasiado grande' }, { status: 413 });
  }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });
  }
  const { nombre, zip, estado } = parsed.data;

  if (!(await rateLimit(`solicitar:usuario:${user.id}`, 20, 60))) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes seguidas. Espera unos minutos.' }, { status: 429 },
    );
  }

  /* Se normaliza a una lista de baños: el envío de un solo baño es la lista
     de uno. */
  const banos = parsed.data.banos ?? [{
    proyecto: parsed.data.proyecto!, repeticiones: parsed.data.repeticiones, nombre: undefined as string | undefined,
  }];
  const varios = banos.length > 1;

  /* Se cotiza cada baño y se acumula. El despiece se multiplica por las
     repeticiones de SU baño (el flete no: se cotiza una vez por obra, y solo
     el del primer baño entra al desglose). Cuando hay varios baños, cada línea
     se etiqueta con el nombre del baño para que el taller no los confunda. */
  let totalCents = 0;
  let unitCount = 0;
  let sortOrder = 0;
  const materiales = new Set<string>();
  const lineas: (typeof quoteLines.$inferInsert)[] = [];

  for (let bi = 0; bi < banos.length; bi++) {
    const b = banos[bi];
    const { bom } = await cotizar(b.proyecto);
    const N = b.repeticiones;
    totalCents += sinEnvioCents(bom) * N;
    unitCount += cuentaUnidades(b.proyecto) * N;
    materiales.add(b.proyecto.materialId);
    const etiqueta = varios ? (b.nombre?.trim() || `Baño ${bi + 1}`) : null;

    for (const l of bom.lines) {
      if (l.category === 'flete' && bi > 0) continue;   // un solo flete por obra
      const mult = l.category === 'flete' ? 1 : N;
      lineas.push({
        quoteId: '',   // se rellena al tener el id
        sku: l.sku,
        name: etiqueta ? `${etiqueta} · ${l.name}` : l.name,
        category: l.category,
        neededMilli: l.neededMilli * mult, billedMilli: l.billedMilli * mult,
        unit: l.unit, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents * mult,
        sortOrder: sortOrder++,
      });
    }
  }
  const materialId = materiales.size === 1 ? [...materiales][0] : null;
  const totalReps = banos.reduce((s, b) => s + b.repeticiones, 0);
  const nombreFinal = varios
    ? `${nombre} (${banos.length} baños distintos)`
    : (banos[0].repeticiones > 1 ? `${nombre} (× ${banos[0].repeticiones} baños)` : nombre);

  const quote = await db.transaction(async (tx) => {
    const [q] = await tx.insert(quotes).values({
      userId: user.id,
      reference: sql`'BETA-' || lpad(nextval('quote_ref_seq')::text, 6, '0')`,
      name: nombreFinal,
      status: 'submitted',
      payload: {
        v: 2,
        banos: banos.map((b) => ({ proyecto: b.proyecto, repeticiones: b.repeticiones, nombre: b.nombre ?? null })),
        estado: estado ?? null, zip: zip ?? null,
      },
      totalCents,
      currency: 'MXN',
      materialId,
      unitCount,
    }).returning();

    if (lineas.length) {
      await tx.insert(quoteLines).values(lineas.map((l) => ({ ...l, quoteId: q.id })));
    }

    await tx.insert(quoteEvents).values({
      quoteId: q.id,
      type: 'submitted',
      toStatus: 'submitted',
      message: varios
        ? `Solicitud enviada desde el cotizador: ${banos.length} baños distintos (${totalReps} en total).`
        : (banos[0].repeticiones > 1
            ? `Solicitud enviada desde el cotizador: ${banos[0].repeticiones} baños idénticos.`
            : 'Solicitud enviada desde el cotizador.'),
      actorId: user.id,
      visibleToCustomer: true,
    });

    return q;
  });

  /* Los correos son cortesía, no parte de la transacción: si el proveedor
     falla, la solicitud YA está guardada y visible en el portal y el panel. */
  const url = `/portal/${quote.id}`;
  const totalTxt = money(quote.totalCents, quote.currency);
  try {
    await solicitudClienteMail(user.email, user.name, quote.reference, url);
    const staff = await db.query.users.findMany({ where: ne(users.role, 'customer') });
    for (const s of staff) {
      await solicitudAdminMail(s.email, s.name, quote.reference, user.name, user.company, totalTxt, url);
    }
  } catch (err) {
    console.error('Correo de solicitud no enviado:', err);
  }

  return NextResponse.json({ ok: true, url, reference: quote.reference });
}
