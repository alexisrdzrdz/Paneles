'use server';

import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { catalogItems, assemblyRules } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { buildBom, measure, type RoomSpec, type Unit, type BomResult } from '@/lib/bom';
import { parseLength, type DisplayUnit } from '@/lib/units';

/* Grosor de pilastra: 3" ≈ 76 mm. Es la misma constante que usa el
   configurador (PL = 3 pulgadas), aquí en el sistema canónico. */
const PILASTRA_MM = 76;

export type CalcInput = {
  unit: DisplayUnit;
  materialId: string;
  stalls: number; stallWidth: string; stallDepth: string; doorOpening: string;
  urinals: number; urinalWidth: string; urinalDepth: string;
  height: string;
  backPanel: boolean;
  headrail: boolean;
};

export type CalcResult = {
  error?: string;
  bom?: BomResult;
  /* Se devuelve la geometría deducida para que el admin compruebe que la
     calculadora entendió lo que capturó, en vez de confiar a ciegas. */
  geom?: {
    runLengthMm: number; heightMm: number;
    cabinas: number; mingitorios: number; puertas: number;
    divAltas: number; divCortas: number;
    areaM2: number;
  };
  faltanPrecios?: string[];
};

export async function calcular(_prev: CalcResult, form: FormData): Promise<CalcResult> {
  const user = await currentUser();
  if (!isAdmin(user)) return { error: 'No autorizado' };

  const unit = (String(form.get('unit') ?? 'm') as DisplayUnit);
  const num = (k: string) => Math.max(0, Math.floor(Number(form.get(k) ?? 0)));
  const len = (k: string) => parseLength(String(form.get(k) ?? ''), unit);

  const stalls = num('stalls'), urinals = num('urinals');
  if (stalls + urinals < 1) return { error: 'Captura al menos una cabina o un mingitorio.' };

  const heightMm = len('height');
  const stallW = stalls ? len('stallWidth') : 0;
  const stallD = stalls ? len('stallDepth') : 0;
  const doorMm = stalls ? len('doorOpening') : 0;
  const urinalW = urinals ? len('urinalWidth') : 0;
  const urinalD = urinals ? len('urinalDepth') : 0;

  const faltan: string[] = [];
  if (!heightMm) faltan.push('altura del panel');
  if (stalls && !stallW) faltan.push('ancho de cabina');
  if (stalls && !stallD) faltan.push('profundidad de cabina');
  if (stalls && !doorMm) faltan.push('apertura de puerta');
  if (urinals && !urinalW) faltan.push('separación entre mingitorios');
  if (urinals && !urinalD) faltan.push('fondo de mampara');
  if (faltan.length) {
    return { error: `No entendí estas medidas: ${faltan.join(', ')}. Escribe algo como "1.5 m", "150cm" o "60\"".` };
  }

  /* Las unidades se ordenan cabinas primero y mingitorios después, que es como
     se construye en obra: el grupo de mingitorios comparte sus mamparas. */
  const units: Unit[] = [
    ...Array.from({ length: stalls }, (): Unit => ({
      kind: 'stall', widthMm: stallW!, depthMm: stallD!,
      doorOpeningMm: Math.min(doorMm!, stallW!), privacy: false, ada: false,
    })),
    ...Array.from({ length: urinals }, (): Unit => ({
      kind: 'urinal', widthMm: urinalW!, depthMm: urinalD!,
      doorOpeningMm: 0, privacy: false, ada: false,
    })),
  ];

  /* Fronteras: una entre cada par contiguo, más las dos de los extremos.
     Es alta si CUALQUIERA de sus vecinos es cabina — un panel completo manda
     sobre una mampara corta. */
  const boundaries = [];
  for (let i = 0; i <= units.length; i++) {
    const izq = units[i - 1], der = units[i];
    const vecinos = [izq, der].filter(Boolean) as Unit[];
    boundaries.push({
      tall: vecinos.some((u) => u.kind === 'stall'),
      depthMm: Math.max(...vecinos.map((u) => u.depthMm)),
    });
  }

  const runLengthMm = units.reduce((s, u) => s + u.widthMm, 0)
    + PILASTRA_MM * (units.length + 1);

  const room: RoomSpec = {
    materialId: String(form.get('materialId') ?? 'hdpe'),
    heightMm: heightMm!,
    floorGapMm: 0,
    backPanel: form.get('backPanel') === 'on',
    headrail: form.get('headrail') === 'on' ? 'total' : 'none',
    runs: [{ lengthMm: runLengthMm, units, boundaries }],
  };

  const items = await db.query.catalogItems.findMany({
    where: eq(catalogItems.active, true), orderBy: [asc(catalogItems.sku)],
  });
  const rules = await db.query.assemblyRules.findMany({ where: eq(assemblyRules.active, true) });

  /* El riel solo entra si se pidió: su regla apunta a 'hilera', que siempre
     aplica, así que se filtra aquí en vez de ensuciar el motor. */
  const rielIds = new Set(items.filter((i) => i.category === 'riel').map((i) => i.id));
  const efectivas = room.headrail === 'none'
    ? rules.filter((r) => !rielIds.has(r.itemId))
    : rules;

  const bom = buildBom(room, items, efectivas);
  const { count, ext } = measure(room);

  /* Qué piezas del despiece siguen sin precio: ahí está el hueco del total. */
  const faltanPrecios = bom.lines.filter((l) => l.unitPriceCents === 0).map((l) => l.name);

  return {
    bom,
    geom: {
      runLengthMm, heightMm: heightMm!,
      cabinas: count.cabina, mingitorios: count.mingitorio, puertas: count.puerta,
      divAltas: count.division_alta, divCortas: count.division_corta,
      areaM2: ext.hilera.mm2 / 1e6,
    },
    faltanPrecios,
  };
}
