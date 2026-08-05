/* Pruebas del motor de despiece. Se compila el TS al vuelo con el compilador
   que ya trae Next, para no montar un runner aparte. */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const load = (p) => {
  const src = readFileSync(new URL(p, import.meta.url), 'utf8')
    .replace(/^import type .*$/gm, '');
  const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
};

const { billedQuantity, buildBom, measure } = await load('../src/lib/bom.ts');
const { parseLength, formatLength, inchesToMm } = await load('../src/lib/units.ts');

let fails = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? '  ok   ' : '  FAIL ') + n + '  got=' + JSON.stringify(got) + (ok ? '' : ' want=' + JSON.stringify(want)));
};

const item = (o) => ({
  id: o.sku, sku: o.sku, name: o.sku, category: o.category ?? 'otro',
  pricingMode: o.pricingMode ?? 'pieza', unitPriceCents: o.price ?? 0,
  stockLengthMm: o.stockLengthMm ?? null, stockWidthMm: o.stockWidthMm ?? null,
  wastePolicy: o.waste ?? 'exacto', materialId: o.materialId ?? null,
  notes: null, active: true, updatedAt: new Date(),
});
const rule = (o) => ({
  id: o.itemId + o.target, itemId: o.itemId, target: o.target,
  basis: o.basis ?? 'fija', qtyMilli: o.qty ?? 1000,
  materialId: o.materialId ?? null, active: true,
});

console.log('--- 1. El caso del panel de 6 m ---');
const panel6m = item({ sku: 'PANEL-6M', category: 'panel', pricingMode: 'longitud',
  price: 100_00, stockLengthMm: 6000, waste: 'pieza_completa' });

eq('necesito 6.00 m -> facturo 6 m', billedQuantity(panel6m, 6000) / 1000, 6);
eq('necesito 6.25 m -> facturo 12 m (2 tramos)', billedQuantity(panel6m, 6250) / 1000, 12);
eq('necesito 5.10 m -> facturo 6 m (1 tramo)', billedQuantity(panel6m, 5100) / 1000, 6);
eq('necesito 12.00 m -> facturo 12 m exactos', billedQuantity(panel6m, 12000) / 1000, 12);
eq('necesito 12.01 m -> facturo 18 m', billedQuantity(panel6m, 12010) / 1000, 18);
eq('el cobro de 6.25 m es de 2 tramos', Math.round(billedQuantity(panel6m, 6250) / 1000 * 100_00), 1200_00);

console.log('--- 2. Las otras politicas de desperdicio ---');
const exacto = item({ sku: 'X', pricingMode: 'longitud', price: 100_00, waste: 'exacto' });
eq('exacto no infla nada', billedQuantity(exacto, 6250) / 1000, 6.25);
const arriba = item({ sku: 'Y', pricingMode: 'longitud', price: 100_00, waste: 'redondeo_arriba' });
eq('redondeo al alza: 6.25 -> 7', billedQuantity(arriba, 6250) / 1000, 7);
eq('lo que no se usa no se cobra', billedQuantity(panel6m, 0), 0);
const sinTramo = item({ sku: 'Z', pricingMode: 'longitud', price: 100_00, waste: 'pieza_completa' });
eq('pieza_completa sin tramo definido cae a redondeo', billedQuantity(sinTramo, 6250) / 1000, 7);

console.log('--- 3. Hoja completa por area ---');
const hoja = item({ sku: 'HOJA', category: 'panel', pricingMode: 'area', price: 50_00,
  stockLengthMm: 3000, stockWidthMm: 1500, waste: 'pieza_completa' });
eq('hoja de 4.5 m2; pido 5 m2 -> facturo 9 m2', billedQuantity(hoja, 5000) / 1000, 9);

console.log('--- 4. Medicion de la geometria ---');
const cabina = (w) => ({ kind: 'stall', widthMm: w, depthMm: 1500, doorOpeningMm: 600, privacy: false, ada: false });
const ming = (w) => ({ kind: 'urinal', widthMm: w, depthMm: 450, doorOpeningMm: 0, privacy: false, ada: false });
const room = {
  materialId: 'hdpe', heightMm: 1800, floorGapMm: 300, backPanel: true, headrail: 'total',
  runs: [{
    lengthMm: 6250,
    units: [cabina(1500), cabina(1500), ming(750)],
    boundaries: [
      { tall: true, depthMm: 1500 }, { tall: true, depthMm: 1500 },
      { tall: true, depthMm: 1500 }, { tall: false, depthMm: 450 },
    ],
  }],
};
const { count, ext } = measure(room);
eq('cuenta cabinas', count.cabina, 2);
eq('cuenta mingitorios', count.mingitorio, 1);
eq('cuenta puertas (los mingitorios no llevan)', count.puerta, 2);
eq('separa divisiones altas y cortas', [count.division_alta, count.division_corta], [3, 1]);
eq('mide el frente de la hilera', ext.hilera.mm, 6250);

console.log('--- 5. Despiece completo, con desperdicio real ---');
const items = [
  panel6m,
  item({ sku: 'BISAGRA', category: 'bisagra', price: 85_00 }),
  item({ sku: 'CERRADURA', category: 'cerradura', price: 140_00 }),
  item({ sku: 'TAQUETE', category: 'tornilleria', price: 3_50 }),
  item({ sku: 'CORTE', category: 'corte', price: 25_00 }),
  item({ sku: 'INSTALA', category: 'mano_obra', pricingMode: 'hora', price: 320_00 }),
];
const rules = [
  rule({ itemId: 'PANEL-6M', target: 'panel_fondo', basis: 'por_mm' }),
  rule({ itemId: 'BISAGRA', target: 'puerta', qty: 2000 }),
  rule({ itemId: 'CERRADURA', target: 'puerta', qty: 1000 }),
  rule({ itemId: 'TAQUETE', target: 'division_alta', qty: 4000 }),
  rule({ itemId: 'TAQUETE', target: 'division_corta', qty: 2000 }),
  rule({ itemId: 'CORTE', target: 'division_alta', qty: 1000 }),
  rule({ itemId: 'INSTALA', target: 'cabina', qty: 1500 }),
];
const bom = buildBom(room, items, rules);
const line = (sku) => bom.lines.find((l) => l.sku === sku);

eq('el panel de fondo necesita 6.25 m', line('PANEL-6M').neededMilli / 1000, 6.25);
eq('...pero se facturan 12 m', line('PANEL-6M').billedMilli / 1000, 12);
eq('...y se cobra el tramo completo', line('PANEL-6M').totalCents, 1200_00);
eq('2 puertas -> 4 bisagras', line('BISAGRA').billedMilli / 1000, 4);
eq('2 puertas -> 2 cerraduras', line('CERRADURA').billedMilli / 1000, 2);
eq('taquetes de altas y cortas en UNA linea', line('TAQUETE').billedMilli / 1000, 3 * 4 + 1 * 2);
eq('el corte se cobra', line('CORTE').totalCents, 3 * 25_00);
eq('mano de obra en horas', [line('INSTALA').billedMilli / 1000, line('INSTALA').unit], [3, 'h']);
eq('el subtotal suma todas las lineas',
  bom.subtotalCents, bom.lines.reduce((s, l) => s + l.totalCents, 0));
eq('cada tornillo cuenta', bom.lines.some((l) => l.category === 'tornilleria'), true);

console.log('--- 6. El catalogo manda: sin reglas no hay precio ---');
eq('sin reglas, cero', buildBom(room, items, []).subtotalCents, 0);
const soloOtro = buildBom(room, items.map((i) => ({ ...i, materialId: 'inox' })), rules);
eq('una pieza de otro material no entra', soloOtro.subtotalCents, 0);

console.log('--- 7. Unidades: se teclea como se habla ---');
eq('«2.4 m»', parseLength('2.4 m', 'metrico'), 2400);
eq('«240cm»', parseLength('240cm', 'metrico'), 2400);
eq('«2400» en metrico son mm', parseLength('2400', 'metrico'), 2400);
eq('«94.5"»', parseLength('94.5"', 'metrico'), inchesToMm(94.5));
eq('«7\' 10 1/2"»', parseLength(`7' 10 1/2"`, 'imperial'), inchesToMm(94.5));
eq('«60» en imperial son pulgadas', parseLength('60', 'imperial'), inchesToMm(60));
eq('basura -> null', parseLength('como tres metros', 'metrico'), null);
eq('formato metrico', formatLength(2400, 'metrico'), '2.40 m');
eq('formato imperial', formatLength(inchesToMm(94.5), 'imperial'), `7'-10 1/2"`);

console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde');
process.exitCode = fails ? 1 : 0;
