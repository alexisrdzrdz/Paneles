/* Estructura del tabulador: piezas y reglas de armado.
   LOS PRECIOS VAN EN CERO A PROPÓSITO. Las reglas (cuántas bisagras lleva una
   puerta, cuántos taquetes una división) son conocimiento técnico y sí se
   siembran; los importes son de Mauricios y los captura el administrador.
   Uso:  npm run seed:catalog */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);
const sql = postgres(env.DATABASE_URL);

/* sku, nombre, categoría, modo, largo comercial (mm), ancho (mm), sobrante, nota */
const ITEMS = [
  ['HOJA-ACERO', 'Hoja de acero 3 × 1.5 m',      'panel',       'area',     3000, 1500, 'pieza_completa', 'Hoja de 4.5 m². El sobrante se cobra completo.'],
  ['PANEL-FONDO','Panel de fondo',               'panel',       'longitud', 6000, null, 'pieza_completa', 'Tramo de 6 m: pedir 6.25 factura 12.'],
  ['PUERTA',     'Puerta de cabina',             'puerta',      'pieza',    null, null, 'exacto',         ''],
  ['PILASTRA',   'Pilastra',                     'pilastra',    'pieza',    null, null, 'exacto',         ''],
  ['MAMPARA',    'Mampara de mingitorio',        'mampara',     'pieza',    null, null, 'exacto',         ''],
  ['RIEL',       'Riel superior',                'riel',        'longitud', 6000, null, 'pieza_completa', 'Solo si el cliente lo pide.'],
  ['BISAGRA',    'Bisagra',                      'bisagra',     'pieza',    null, null, 'exacto',         ''],
  ['CERRADURA',  'Cerradura con indicador',      'cerradura',   'pieza',    null, null, 'exacto',         ''],
  ['JALADERA',   'Jaladera',                     'jaladera',    'pieza',    null, null, 'exacto',         ''],
  ['GANCHO',     'Gancho de ropa',               'gancho',      'pieza',    null, null, 'exacto',         ''],
  ['ESCUADRA',   'Escuadra de fijación',         'escuadra',    'pieza',    null, null, 'exacto',         ''],
  ['ZAPATA',     'Zapata de piso',               'zapata',      'pieza',    null, null, 'exacto',         ''],
  ['TAQUETE',    'Taquete de expansión',         'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['TORNILLO',   'Tornillo inoxidable',          'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['PIJA',       'Pija autoperforante',          'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['EMPAQUE-P',  'Empaque perimetral',           'empaque',     'longitud', 5000, null, 'pieza_completa', 'Rollo de 5 m.'],
  ['EMPAQUE-U',  'Empaque de unión entre hojas', 'empaque',     'pieza',    null, null, 'exacto',         ''],
  ['SELLO',      'Sello de silicón',             'empaque',     'pieza',    null, null, 'exacto',         'Cartucho.'],
  ['CORTE',      'Corte y canteado',             'corte',       'pieza',    null, null, 'exacto',         'Por pieza maquinada.'],
  ['INSTALACION','Instalación',                  'mano_obra',   'hora',     null, null, 'exacto',         'Horas por cabina.'],
  ['FLETE',      'Flete',                        'flete',       'pieza',    null, null, 'exacto',         ''],
];

/* sku, objetivo, base, cantidad (×1000). Esto es el "cada tornillo cuenta". */
const RULES = [
  ['HOJA-ACERO', 'division_alta',  'por_mm2', 1000],
  ['HOJA-ACERO', 'division_corta', 'por_mm2', 1000],
  ['PANEL-FONDO','panel_fondo',    'por_mm',  1000],
  ['PUERTA',     'puerta',         'fija',    1000],
  ['PILASTRA',   'division_alta',  'fija',    1000],
  ['MAMPARA',    'division_corta', 'fija',    1000],
  ['RIEL',       'hilera',         'por_mm',  1000],
  ['BISAGRA',    'puerta',         'fija',    2000],   // 2 por puerta
  ['CERRADURA',  'puerta',         'fija',    1000],
  ['JALADERA',   'puerta',         'fija',    1000],
  ['GANCHO',     'puerta',         'fija',    1000],
  ['ESCUADRA',   'division_alta',  'fija',    2000],
  ['ESCUADRA',   'division_corta', 'fija',    2000],
  ['ZAPATA',     'division_alta',  'fija',    1000],
  ['TAQUETE',    'division_alta',  'fija',    4000],   // 4 al piso/muro
  ['TAQUETE',    'division_corta', 'fija',    2000],
  ['TORNILLO',   'puerta',         'fija',    8000],   // bisagras + cerradura
  ['TORNILLO',   'division_alta',  'fija',    6000],
  ['PIJA',       'hilera',         'fija',    8000],
  ['EMPAQUE-P',  'division_alta',  'por_mm',  1000],
  ['EMPAQUE-U',  'division_alta',  'fija',    2000],
  ['SELLO',      'proyecto',       'fija',    2000],
  ['CORTE',      'division_alta',  'fija',    1000],
  ['CORTE',      'division_corta', 'fija',    1000],
  ['INSTALACION','cabina',         'fija',    1500],   // 1.5 h por cabina
  ['INSTALACION','mingitorio',     'fija',     750],
  ['FLETE',      'proyecto',       'fija',    1000],
];

await sql`delete from assembly_rules`;
await sql`delete from catalog_items`;

const ids = {};
for (const [sku, name, category, mode, len, wid, waste, notes] of ITEMS) {
  const [row] = await sql`
    insert into catalog_items (sku, name, category, pricing_mode, unit_price_cents,
                               stock_length_mm, stock_width_mm, waste_policy, notes)
    values (${sku}, ${name}, ${category}, ${mode}, 0,
            ${len}, ${wid}, ${waste}, ${notes || null})
    returning id`;
  ids[sku] = row.id;
}
for (const [sku, target, basis, qty] of RULES) {
  await sql`insert into assembly_rules (item_id, target, basis, qty_milli)
            values (${ids[sku]}, ${target}, ${basis}, ${qty})`;
}

console.log(`Tabulador sembrado: ${ITEMS.length} piezas, ${RULES.length} reglas.`);
console.log('⚠  Todos los precios están en $0. Captúralos desde el panel de administración.');
await sql.end();
