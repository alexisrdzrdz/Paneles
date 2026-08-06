import { NextResponse } from 'next/server';
import { z } from 'zod';
import { proyectoSchema, cotizar } from '@/lib/cotizacion';

/* Precio en vivo para el cotizador. Público a propósito: cotizar no exige
   cuenta. No escribe nada; solo lee el tabulador y calcula. */

const bodySchema = z.object({
  proyecto: proyectoSchema,
  comparar: z.array(z.string().max(40)).max(8).default([]),
});

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });
  }

  const { bom, faltanPrecios, porMaterial } = await cotizar(parsed.data.proyecto, parsed.data.comparar);
  return NextResponse.json({
    currency: 'MXN',
    totalCents: bom.subtotalCents,
    lines: bom.lines,
    faltanPrecios,
    porMaterial,
  });
}
