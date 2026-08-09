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
  /* Hacia dónde abre la puerta. No afecta el precio, pero viaja con el
     proyecto porque el taller lo necesita para fabricar. */
  doorSwing: z.enum(['left-in', 'left-out', 'right-in', 'right-out']).nullish(),
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
  /* Total con cada material alternativo, para la comparación del paso 4.
     SIN envío: es lo que el cliente compara y el flete no cambia con el
     material. */
  porMaterial: Record<string, number>;
};

/* Lo que ve el cliente: todo menos el flete. El envío se cotiza aparte según
   la obra, y el desglose interno del taller no viaja al navegador. */
export const sinEnvioCents = (b: BomResult) =>
  b.subtotalCents - b.lines.filter((l) => l.category === 'flete')
    .reduce((s, l) => s + l.totalCents, 0);

export async function cotizar(p: Proyecto, comparar: string[] = []): Promise<Cotizacion> {
  const { items, rules } = await catalogo();

  /* Igual que en la calculadora del admin: el riel apunta a 'hilera', que
     siempre existe, así que si no se pidió se filtra aquí. */
  const rielIds = new Set(items.filter((i) => i.category === 'riel').map((i) => i.id));
  const efectivas = p.headrail === 'none'
    ? rules.filter((r) => !rielIds.has(r.itemId))
    : rules;

  /* La geometría no cambia entre materiales: se convierte UNA vez y solo se
     intercambia el materialId para cada comparación. */
  const spec = toRoomSpec(p);
  const bom = buildBom(spec, items, efectivas);

  /* Sin flete: el aviso de "faltan precios" debe hablar del mismo conjunto
     de líneas que suma el total que el cliente ve. Un flete en $0 no es un
     hueco — el envío se cotiza aparte. */
  const faltanPrecios = bom.lines
    .filter((l) => l.category !== 'flete' && l.unitPriceCents === 0)
    .map((l) => l.name);

  const porMaterial: Record<string, number> = { [p.materialId]: sinEnvioCents(bom) };
  for (const id of comparar.slice(0, 8)) {
    if (porMaterial[id] !== undefined) continue;
    porMaterial[id] = sinEnvioCents(buildBom({ ...spec, materialId: id }, items, efectivas));
  }

  return { bom, faltanPrecios, porMaterial };
}
