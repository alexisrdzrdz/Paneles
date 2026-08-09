'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { catalogItems, assemblyRules } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { MATERIALES } from '@/lib/materiales';

/* Toda acción del tabulador pasa por aquí. Si esta comprobación falla, el
   cliente podría reescribir los precios: es la puerta, no un adorno. */
async function requireAdmin() {
  const user = await currentUser();
  if (!isAdmin(user)) throw new Error('No autorizado');
  return user!;
}

export type CatalogState = { error?: string; ok?: string };

/* Drizzle envuelve el error de Postgres, así que el mensaje original vive en
   `cause`. Se recorre la cadena buscando el 23505 (violación de único) en vez
   de confiar en el texto del wrapper. */
function isUniqueViolation(e: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = e;
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const o = cur as { code?: string; message?: string; cause?: unknown };
    if (o.code === '23505') return true;
    if (typeof o.message === 'string' && /duplicate key|unique constraint/i.test(o.message)) return true;
    cur = o.cause;
  }
  return false;
}

const CATEGORIES = ['panel','puerta','pilastra','mampara','bisagra','cerradura','jaladera',
  'gancho','escuadra','zapata','riel','tornilleria','empaque','corte','mano_obra','flete','otro'] as const;
const MODES = ['pieza','longitud','area','hora'] as const;
const WASTE = ['exacto','pieza_completa','redondeo_arriba'] as const;
const TARGETS = ['cabina','mingitorio','puerta','division_alta','division_corta',
  'hilera','panel_fondo','proyecto','privacidad','ada'] as const;
const BASES = ['fija','por_mm','por_mm2'] as const;

/* El precio se captura en pesos y se guarda en centavos enteros: nunca float
   para dinero. "1,250.50" y "1250.5" entran igual. */
const pesos = z.string()
  .transform((v) => Number(v.replace(/[$,\s]/g, '') || '0'))
  .refine((n) => Number.isFinite(n) && n >= 0, 'El precio debe ser un número mayor o igual a cero')
  .transform((n) => Math.round(n * 100));

/* Longitud comercial capturada en mm; vacío = la pieza no tiene tramo. */
const mmOpt = z.string().transform((v) => v.trim())
  .transform((v) => (v === '' ? null : Math.round(Number(v))))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Medida inválida');

const itemSchema = z.object({
  sku: z.string().trim().min(2, 'El SKU es obligatorio').max(40)
    .regex(/^[A-Za-z0-9._-]+$/, 'El SKU solo admite letras, números, punto, guion y guion bajo'),
  name: z.string().trim().min(2, 'Escribe el nombre de la pieza').max(140),
  category: z.enum(CATEGORIES),
  pricingMode: z.enum(MODES),
  unitPriceCents: pesos,
  stockLengthMm: mmOpt,
  stockWidthMm: mmOpt,
  wastePolicy: z.enum(WASTE),
  /* Vacío = la pieza sirve para cualquier material (herrajes, flete). Con
     material, el motor solo la usa cuando el proyecto es de ese material. */
  materialId: z.string().trim().max(40).optional()
    .transform((v) => v || null)
    .refine((v) => v === null || MATERIALES.some((m) => m.id === v), 'Material desconocido'),
  notes: z.string().trim().max(300).optional(),
});

export async function saveItem(_prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const parsed = itemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  /* "Pieza completa" sin tramo comercial no puede redondear a nada. Avisar es
     mejor que aceptarlo y cobrar mal en silencio. */
  if (v.wastePolicy === 'pieza_completa' && !v.stockLengthMm) {
    return { error: 'Para cobrar pieza completa hace falta el tramo comercial (mm).' };
  }
  if (v.pricingMode === 'area' && v.wastePolicy === 'pieza_completa' && !v.stockWidthMm) {
    return { error: 'Una hoja se define con largo y ancho. Falta el ancho (mm).' };
  }

  try {
    if (id) {
      await db.update(catalogItems).set({ ...v, notes: v.notes || null, updatedAt: new Date() })
        .where(eq(catalogItems.id, id));
    } else {
      await db.insert(catalogItems).values({ ...v, notes: v.notes || null });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Ya existe una pieza con el SKU ${v.sku}.` };
    throw e;
  }
  revalidatePath('/admin');
  return { ok: `${v.name} guardado.` };
}

export async function toggleItem(id: string, active: boolean) {
  await requireAdmin();
  await db.update(catalogItems).set({ active, updatedAt: new Date() })
    .where(eq(catalogItems.id, id));
  revalidatePath('/admin');
}

/* Se desactiva, no se borra: una cotización vieja tiene que poder explicar de
   dónde salió cada línea. */
export async function deleteItem(id: string) {
  await requireAdmin();
  await db.update(catalogItems).set({ active: false, updatedAt: new Date() })
    .where(eq(catalogItems.id, id));
  revalidatePath('/admin');
}

const ruleSchema = z.object({
  itemId: z.string().uuid('Elige una pieza'),
  target: z.enum(TARGETS),
  basis: z.enum(BASES),
  /* Cantidad con decimales (1.5 horas por cabina) guardada ×1000. */
  qtyMilli: z.string()
    .transform((v) => Number(v.replace(/,/g, '.')))
    .refine((n) => Number.isFinite(n) && n > 0, 'La cantidad debe ser mayor que cero')
    .transform((n) => Math.round(n * 1000)),
});

export async function saveRule(_prev: CatalogState, form: FormData): Promise<CatalogState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const parsed = ruleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (id) await db.update(assemblyRules).set(parsed.data).where(eq(assemblyRules.id, id));
  else await db.insert(assemblyRules).values(parsed.data);

  revalidatePath('/admin');
  return { ok: 'Regla guardada.' };
}

export async function deleteRule(id: string) {
  await requireAdmin();
  await db.delete(assemblyRules).where(eq(assemblyRules.id, id));
  revalidatePath('/admin');
}
