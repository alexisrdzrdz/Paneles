import type { CatalogItem, AssemblyRule, QuoteStatus } from '@/db/schema';

/* ═══════════════ Motor de despiece ═══════════════
   Convierte la geometría de un baño en la lista real de piezas y su costo.
   Nada de precios en el código: todo sale del catálogo que edita el admin.

   La regla que importa es el desperdicio. Si el panel se surte en tramos de
   6 m y el proyecto pide 6.25, se cobran DOS tramos (12 m), no 6.25: el
   sobrante se corta y se tira, y alguien lo paga. */

/* ── Lo que el configurador entrega ───────────────────────────────────── */
export type Unit = {
  kind: 'stall' | 'urinal';
  widthMm: number;
  depthMm: number;
  doorOpeningMm: number;
  privacy: boolean;
  ada: boolean;
};

export type Boundary = { tall: boolean; depthMm: number };

export type Run = { lengthMm: number; units: Unit[]; boundaries: Boundary[] };

export type RoomSpec = {
  materialId: string;
  heightMm: number;
  floorGapMm: number;
  backPanel: boolean;          // ¿se cotiza panel de fondo?
  headrail: 'none' | 'flush' | 'total';
  runs: Run[];
};

/* ── Lo que devuelve ──────────────────────────────────────────────────── */
export type BomLine = {
  sku: string;
  name: string;
  category: CatalogItem['category'];
  /* Lo que el proyecto necesita y lo que se factura. Con desperdicio no
     coinciden, y esa diferencia se le enseña al cliente en vez de esconderla. */
  neededMilli: number;
  billedMilli: number;
  unit: 'pz' | 'm' | 'm²' | 'h';
  unitPriceCents: number;
  totalCents: number;
};

export type BomResult = { lines: BomLine[]; subtotalCents: number };

const UNIT_OF: Record<CatalogItem['pricingMode'], BomLine['unit']> = {
  pieza: 'pz', longitud: 'm', area: 'm²', hora: 'h',
};

/* ── Cuánto se factura de una pieza ───────────────────────────────────── */
/* `needed` viene en milésimas de la unidad de venta (piezas, metros, m², horas)
   para no arrastrar decimales. Devuelve también milésimas. */
export function billedQuantity(item: CatalogItem, neededMilli: number): number {
  if (neededMilli <= 0) return 0;

  switch (item.wastePolicy) {
    case 'exacto':
      return neededMilli;

    case 'redondeo_arriba':
      // Al alza hasta la unidad entera: 6.25 m → 7 m; 2.1 pz → 3 pz.
      return Math.ceil(neededMilli / 1000) * 1000;

    case 'pieza_completa': {
      /* Solo tiene sentido si la pieza se surte en un largo comercial. Sin
         `stockLengthMm` no hay tramo que redondear: se cobra al alza. */
      if (!item.stockLengthMm || item.stockLengthMm <= 0) {
        return Math.ceil(neededMilli / 1000) * 1000;
      }
      if (item.pricingMode === 'longitud') {
        const stockM = item.stockLengthMm / 1000;               // p. ej. 6
        const neededM = neededMilli / 1000;                     // p. ej. 6.25
        const piezas = Math.ceil(neededM / stockM);             // → 2
        return Math.round(piezas * stockM * 1000);              // → 12000 (12 m)
      }
      if (item.pricingMode === 'area' && item.stockWidthMm) {
        /* Hoja completa: el área facturable es múltiplo de la hoja entera. */
        const hojaM2 = (item.stockLengthMm / 1000) * (item.stockWidthMm / 1000);
        const hojas = Math.ceil(neededMilli / 1000 / hojaM2);
        return Math.round(hojas * hojaM2 * 1000);
      }
      return Math.ceil(neededMilli / 1000) * 1000;
    }
  }
}

/* ── Cuántas veces aplica cada regla ──────────────────────────────────── */
type Targets = {
  cabina: number; mingitorio: number; puerta: number;
  division_alta: number; division_corta: number; hilera: number;
  panel_fondo: number; proyecto: number;
};

/* Longitud (mm) y área (mm²) asociadas a cada objetivo, para las reglas que
   no son "por pieza" sino por metro lineal o por metro cuadrado. */
type Extents = Record<keyof Targets, { mm: number; mm2: number }>;

export function measure(room: RoomSpec): { count: Targets; ext: Extents } {
  const count: Targets = {
    cabina: 0, mingitorio: 0, puerta: 0, division_alta: 0,
    division_corta: 0, hilera: 0, panel_fondo: 0, proyecto: 1,
  };
  const ext: Extents = {
    cabina: { mm: 0, mm2: 0 }, mingitorio: { mm: 0, mm2: 0 }, puerta: { mm: 0, mm2: 0 },
    division_alta: { mm: 0, mm2: 0 }, division_corta: { mm: 0, mm2: 0 },
    hilera: { mm: 0, mm2: 0 }, panel_fondo: { mm: 0, mm2: 0 }, proyecto: { mm: 0, mm2: 0 },
  };

  const H = room.heightMm;

  for (const run of room.runs) {
    if (!run.units.length) continue;
    count.hilera++;
    ext.hilera.mm += run.lengthMm;
    ext.hilera.mm2 += run.lengthMm * H;

    for (const u of run.units) {
      if (u.kind === 'urinal') {
        count.mingitorio++;
        ext.mingitorio.mm += u.widthMm;
        ext.mingitorio.mm2 += u.widthMm * H;
      } else {
        count.cabina++;
        ext.cabina.mm += u.widthMm;
        ext.cabina.mm2 += u.widthMm * H;
        if (u.doorOpeningMm > 0) {
          count.puerta++;
          ext.puerta.mm += u.doorOpeningMm;
          ext.puerta.mm2 += u.doorOpeningMm * H;
        }
      }
    }

    /* Cada división se mide con SU profundidad: una mampara de mingitorio no
       gasta el mismo panel que una partición de cabina. */
    for (const b of run.boundaries) {
      const key = b.tall ? 'division_alta' : 'division_corta';
      count[key]++;
      ext[key].mm += b.depthMm;
      ext[key].mm2 += b.depthMm * H;
    }

    if (room.backPanel) {
      count.panel_fondo++;
      ext.panel_fondo.mm += run.lengthMm;
      ext.panel_fondo.mm2 += run.lengthMm * H;
    }
  }

  ext.proyecto.mm = ext.hilera.mm;
  ext.proyecto.mm2 = ext.hilera.mm2;
  return { count, ext };
}

/* ── Despiece ─────────────────────────────────────────────────────────── */
export function buildBom(
  room: RoomSpec,
  items: CatalogItem[],
  rules: AssemblyRule[],
): BomResult {
  const byId = new Map(items.map((i) => [i.id, i]));
  const { count, ext } = measure(room);
  /* Se acumula por SKU: cuatro reglas que pidan el mismo taquete producen una
     sola línea con la suma, no cuatro líneas de "taquete". */
  const acc = new Map<string, { item: CatalogItem; neededMilli: number }>();

  for (const rule of rules) {
    if (!rule.active) continue;
    const item = byId.get(rule.itemId);
    if (!item || !item.active) continue;
    /* Una regla atada a un material solo corre si es el material elegido. */
    if (rule.materialId && rule.materialId !== room.materialId) continue;
    if (item.materialId && item.materialId !== room.materialId) continue;

    const target = rule.target;
    const n = count[target];
    if (!n) continue;

    let needed: number;
    switch (rule.basis) {
      case 'fija':
        needed = rule.qtyMilli * n;                          // milésimas de pieza
        break;
      case 'por_mm':
        needed = Math.round((rule.qtyMilli * ext[target].mm) / 1000);   // → milésimas de metro
        break;
      case 'por_mm2':
        needed = Math.round((rule.qtyMilli * ext[target].mm2) / 1e6);   // → milésimas de m²
        break;
    }
    if (needed <= 0) continue;

    const prev = acc.get(item.sku);
    if (prev) prev.neededMilli += needed;
    else acc.set(item.sku, { item, neededMilli: needed });
  }

  const lines: BomLine[] = [];
  for (const { item, neededMilli } of acc.values()) {
    const billedMilli = billedQuantity(item, neededMilli);
    lines.push({
      sku: item.sku,
      name: item.name,
      category: item.category,
      neededMilli,
      billedMilli,
      unit: UNIT_OF[item.pricingMode],
      unitPriceCents: item.unitPriceCents,
      /* El precio se aplica a lo FACTURADO, no a lo necesario. Ahí vive el
         desperdicio del ejemplo de los 6.25 m. */
      totalCents: Math.round((billedMilli / 1000) * item.unitPriceCents),
    });
  }

  const order: CatalogItem['category'][] = [
    'panel', 'puerta', 'pilastra', 'mampara', 'riel', 'bisagra', 'cerradura',
    'jaladera', 'gancho', 'escuadra', 'zapata', 'tornilleria', 'corte',
    'mano_obra', 'flete', 'otro',
  ];
  lines.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)
    || a.name.localeCompare(b.name));

  return { lines, subtotalCents: lines.reduce((s, l) => s + l.totalCents, 0) };
}

export const statusIsOpen = (s: QuoteStatus) =>
  s !== 'delivered' && s !== 'cancelled';
