import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, quoteLines, quoteEvents, users } from '@/db/schema';
import { currentUser, rateLimit } from '@/lib/auth';
import { proyectoSchema, cotizar, cuentaUnidades } from '@/lib/cotizacion';
import { money } from '@/lib/quotes';
import { solicitudClienteMail, solicitudAdminMail } from '@/lib/mail';

/* Convierte lo armado en el cotizador en una solicitud real: folio, desglose
   con los precios DEL DÍA materializado línea por línea, bitácora y correos.
   El total se recalcula aquí; el que calculó el navegador no se le cree. */

const bodySchema = z.object({
  proyecto: proyectoSchema,
  nombre: z.string().trim().min(1).max(120).catch('Baño'),
  zip: z.string().trim().max(10).optional(),
  /* Estado íntegro del configurador, para poder reabrir el proyecto tal cual
     se dejó. Opaco a propósito: el servidor no lo interpreta, solo lo guarda. */
  estado: z.unknown().optional(),
});

export async function POST(req: Request) {
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
  const { proyecto, nombre, zip, estado } = parsed.data;

  if (!(await rateLimit(`solicitar:usuario:${user.id}`, 20, 60))) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes seguidas. Espera unos minutos.' }, { status: 429 },
    );
  }

  const { bom } = await cotizar(proyecto);

  const quote = await db.transaction(async (tx) => {
    const [q] = await tx.insert(quotes).values({
      userId: user.id,
      reference: sql`'MAU-' || lpad(nextval('quote_ref_seq')::text, 6, '0')`,
      name: nombre,
      status: 'submitted',
      payload: { v: 1, proyecto, estado: estado ?? null, zip: zip ?? null },
      totalCents: bom.subtotalCents,
      currency: 'MXN',
      materialId: proyecto.materialId,
      unitCount: cuentaUnidades(proyecto),
    }).returning();

    if (bom.lines.length) {
      await tx.insert(quoteLines).values(bom.lines.map((l, i) => ({
        quoteId: q.id,
        sku: l.sku, name: l.name, category: l.category,
        neededMilli: l.neededMilli, billedMilli: l.billedMilli,
        unit: l.unit, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents,
        sortOrder: i,
      })));
    }

    await tx.insert(quoteEvents).values({
      quoteId: q.id,
      type: 'submitted',
      toStatus: 'submitted',
      message: 'Solicitud enviada desde el cotizador.',
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
