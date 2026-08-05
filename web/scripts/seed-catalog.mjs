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

/* sku, nombre, categoría, modo, tramo comercial (mm), política, nota */
const ITEMS = [
  ['PANEL-DIV',  'Panel divisorio',            'panel',       'area',     3000, 'pieza_completa', 'Hoja comercial; el sobrante se cobra.'],
  ['PANEL-FONDO','Panel de fondo',             'panel',       'longitud', 6000, 'pieza_completa', 'Tramo de 6 m. Pedir 6.25 factura 12.'],
  ['PUERTA',     'Puerta de cabina',           'puerta',      'pieza',    null, 'exacto',         ''],
  ['PILASTRA',   'Pilastra',                   'pilastra',    'pieza',    null, 'exacto',         ''],
  ['MAMPARA',    'Mampara de mingitorio',      'mampara',     'pieza',    null, 'exacto',         ''],
  ['RIEL',       'Riel superior',              'riel',        'longitud', 6000, 'pieza_completa', 'Solo si el cliente lo pide.'],
  ['BISAGRA',    'Bisagra',                    'bisagra',     'pieza',    null, 'exacto',         ''],
  ['CERRADURA',  'Cerradura con indicador',    'cerradura',   'pieza',    null, 'exacto',         ''],
  ['JALADERA',   'Jaladera',                   'jaladera',    'pieza',    null, 'exacto',         ''],
  ['GANCHO',     'Gancho de ropa',             'gancho',      'pieza',    null, 'exacto',         ''],
  ['ESCUADRA',   'Escuadra de fijación',       'escuadra',    'pieza',    null, 'exacto',         ''],
  ['ZAPATA',     'Zapata de piso',             'zapata',      'pieza',    null, 'exacto',         ''],
  ['TAQUETE',    'Taquete expansión',          'tornilleria', 'pieza',    null, 'exacto',         ''],
  ['TORNILLO',   'Tornillo inoxidable',        'tornilleria', 'pieza',    null, 'exacto',         ''],
  ['CORTE',      'Corte y canteado',           'corte',       'pieza',    null, 'exacto',         'Por pieza maquinada.'],
  ['INSTALACION','Instalación',                'mano_obra',   'hora',     null, 'exacto',         'Horas por cabina.'],
  ['FLETE',      'Flete',                      'flete',       'pieza',    null, 'exacto',         ''],
];

/* sku, objetivo, base, cantidad (×1000). Esto es el "cada tornillo cuenta". */
const RULES = [
  ['PANEL-DIV',  'division_alta',  'por_mm2', 1000],
  ['PANEL-DIV',  'division_corta', 'por_mm2', 1000],
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
  ['CORTE',      'division_alta',  'fija',    1000],
  ['CORTE',      'division_corta', 'fija',    1000],
  ['INSTALACION','cabina',         'fija',    1500],   // 1.5 h por cabina
  ['INSTALACION','mingitorio',     'fija',     750],
  ['FLETE',      'proyecto',       'fija',    1000],
];

await sql`delete from assembly_rules`;
await sql`delete from catalog_items`;

const ids = {};
for (const [sku, name, category, mode, stock, waste, notes] of ITEMS) {
  const [row] = await sql`
    insert into catalog_items (sku, name, category, pricing_mode, unit_price_cents,
                               stock_length_mm, waste_policy, notes)
    values (${sku}, ${name}, ${category}, ${mode}, 0, ${stock}, ${waste}, ${notes || null})
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
