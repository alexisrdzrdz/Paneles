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

const bodySchema = z.object({
  proyecto: proyectoSchema,
  nombre: z.string().trim().min(1).max(120).catch('Baño'),
  zip: z.string().trim().max(10).optional(),
  /* Baños idénticos: un edificio de 50 pisos con el mismo baño es 50 copias,
     no una sala gigante. Se cotiza uno y se multiplica. */
  repeticiones: z.number().int().min(1).max(500).catch(1),
  /* Estado íntegro del configurador, para poder reabrir el proyecto tal cual
     se dejó. Opaco a propósito: el servidor no lo interpreta, solo lo guarda. */
  estado: z.unknown().optional(),
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
  const { proyecto, nombre, zip, estado, repeticiones } = parsed.data;

  if (!(await rateLimit(`solicitar:usuario:${user.id}`, 20, 60))) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes seguidas. Espera unos minutos.' }, { status: 429 },
    );
  }

  const { bom } = await cotizar(proyecto);
  const N = repeticiones;
  /* El despiece se multiplica por el número de baños; el flete NO (se cotiza
     una vez por obra, lo ajusta el vendedor en firme). El total sin envío del
     cliente se multiplica completo. */
  const totalCents = sinEnvioCents(bom) * N;

  const quote = await db.transaction(async (tx) => {
    const [q] = await tx.insert(quotes).values({
      userId: user.id,
      reference: sql`'BETA-' || lpad(nextval('quote_ref_seq')::text, 6, '0')`,
      name: N > 1 ? `${nombre} (× ${N} baños)` : nombre,
      status: 'submitted',
      payload: { v: 1, proyecto, estado: estado ?? null, zip: zip ?? null, repeticiones: N },
      totalCents,
      currency: 'MXN',
      materialId: proyecto.materialId,
      unitCount: cuentaUnidades(proyecto) * N,
    }).returning();

    if (bom.lines.length) {
      await tx.insert(quoteLines).values(bom.lines.map((l, i) => {
        const mult = l.category === 'flete' ? 1 : N;
        return {
          quoteId: q.id,
          sku: l.sku, name: l.name, category: l.category,
          neededMilli: l.neededMilli * mult, billedMilli: l.billedMilli * mult,
          unit: l.unit, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents * mult,
          sortOrder: i,
        };
      }));
    }

    await tx.insert(quoteEvents).values({
      quoteId: q.id,
      type: 'submitted',
      toStatus: 'submitted',
      message: N > 1
        ? `Solicitud enviada desde el cotizador: ${N} baños idénticos.`
        : 'Solicitud enviada desde el cotizador.',
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
