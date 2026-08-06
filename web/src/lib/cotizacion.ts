import 'server-only';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { catalogItems, assemblyRules } from '@/db/schema';
import { buildBom, type RoomSpec, type Unit, type BomResult } from '@/lib/bom';
import { inchesToMm } from '@/lib/units';

/* ═══════════════ Puente cotizador → motor de despiece ═══════════════
   El cotizador habla en pulgadas y en hileras dibujadas; el motor habla en
   milímetros y RoomSpec. Aquí se valida lo que manda el navegador (que es
   territorio enemigo: cualquiera puede fabricar el JSON) y se convierte.
   El precio NUNCA viene del cliente: siempre se recalcula del tabulador. */

const inches = (max: number) => z.number().finite().positive().max(max);

const unitSchema = z.object({
  kind: z.enum(['stall', 'urinal']),
  widthIn: inches(120),
  depthIn: inches(120),
  doorIn: z.number().finite().min(0).max(60),
  privacy: z.boolean().default(false),
  ada: z.boolean().default(false),
});

const runSchema = z.object({
  lengthIn: inches(2400),
  units: z.array(unitSchema).max(40),
  boundaries: z.array(z.object({ tall: z.boolean(), depthIn: inches(120) })).max(41),
});

export const proyectoSchema = z.object({
  materialId: z.string().min(1).max(40),
  heightIn: inches(120),
  floorGapIn: z.number().finite().min(0).max(24),
  backPanel: z.boolean().default(false),
  headrail: z.enum(['none', 'flush', 'total']).default('none'),
  runs: z.array(runSchema).min(1).max(4),
}).refine((p) => p.runs.some((r) => r.units.length > 0), {
  message: 'El proyecto no tiene cabinas ni mingitorios',
});

export type Proyecto = z.infer<typeof proyectoSchema>;

export const cuentaUnidades = (p: Proyecto) =>
  p.runs.reduce((s, r) => s + r.units.length, 0);

export function toRoomSpec(p: Proyecto): RoomSpec {
  return {
    materialId: p.materialId,
    heightMm: inchesToMm(p.heightIn),
    floorGapMm: inchesToMm(p.floorGapIn),
    backPanel: p.backPanel,
    headrail: p.headrail,
    runs: p.runs
      .filter((r) => r.units.length > 0)
      .map((r) => ({
        lengthMm: inchesToMm(r.lengthIn),
        units: r.units.map((u): Unit => ({
          kind: u.kind,
          widthMm: inchesToMm(u.widthIn),
          depthMm: inchesToMm(u.depthIn),
          doorOpeningMm: u.kind === 'stall' ? inchesToMm(Math.min(u.doorIn, u.widthIn)) : 0,
          privacy: u.privacy,
          ada: u.ada,
        })),
        boundaries: r.boundaries.map((b) => ({ tall: b.tall, depthMm: inchesToMm(b.depthIn) })),
      })),
  };
}

/* El catálogo cambia cuando el admin lo edita, no a cada tecla del cotizador.
   Un caché corto absorbe la ráfaga de peticiones mientras el cliente ajusta
   medidas, sin dejar precios viejos más de unos segundos. */
type Catalogo = {
  items: Awaited<ReturnType<typeof db.query.catalogItems.findMany>>;
  rules: Awaited<ReturnType<typeof db.query.assemblyRules.findMany>>;
};
let cache: { at: number; data: Catalogo } | null = null;
const CACHE_MS = 15_000;

async function catalogo(): Promise<Catalogo> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [items, rules] = await Promise.all([
    db.query.catalogItems.findMany({
      where: eq(catalogItems.active, true), orderBy: [asc(catalogItems.sku)],
    }),
    db.query.assemblyRules.findMany({ where: eq(assemblyRules.active, true) }),
  ]);
  cache = { at: Date.now(), data: { items, rules } };
  return cache.data;
}

export type Cotizacion = {
  bom: BomResult;
  faltanPrecios: string[];
  /* Total con cada material alternativo, para la comparación del paso 4. */
  porMaterial: Record<string, number>;
};

export async function cotizar(p: Proyecto, comparar: string[] = []): Promise<Cotizacion> {
  const { items, rules } = await catalogo();

  /* Igual que en la calculadora del admin: el riel apunta a 'hilera', que
     siempre existe, así que si no se pidió se filtra aquí. */
  const rielIds = new Set(items.filter((i) => i.category === 'riel').map((i) => i.id));
  const efectivas = p.headrail === 'none'
    ? rules.filter((r) => !rielIds.has(r.itemId))
    : rules;

  const bom = buildBom(toRoomSpec(p), items, efectivas);
  const faltanPrecios = bom.lines.filter((l) => l.unitPriceCents === 0).map((l) => l.name);

  const porMaterial: Record<string, number> = { [p.materialId]: bom.subtotalCents };
  for (const id of comparar.slice(0, 8)) {
    if (porMaterial[id] !== undefined) continue;
    porMaterial[id] = buildBom(toRoomSpec({ ...p, materialId: id }), items, efectivas).subtotalCents;
  }

  return { bom, faltanPrecios, porMaterial };
}
