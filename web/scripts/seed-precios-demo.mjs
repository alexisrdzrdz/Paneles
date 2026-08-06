/* Precios DE EJEMPLO para probar la calculadora. NO son reales.
   Uso:  npm run seed:precios-demo */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const sql = postgres(env.DATABASE_URL);

/* Piezas comunes (centavos). */
const P = { 'BISAGRA':8550, 'CERRADURA':14000, 'JALADERA':6500, 'GANCHO':4500,
  'ESCUADRA':3800, 'ZAPATA':9500, 'TAQUETE':350, 'TORNILLO':180, 'PIJA':220,
  'EMPAQUE-P':12000, 'EMPAQUE-U':2800, 'SELLO':9500, 'CORTE':5500, 'INSTALACION':32000,
  'FLETE':180000, 'RIEL':41000 };

/* Piezas por material: precio base × factor del material, para que la
   comparación del cotizador tenga sentido desde el primer día. */
const BASE = { 'HOJA':125000, 'PANEL-FONDO':38000, 'PUERTA':210000, 'PILASTRA':89000, 'MAMPARA':76000 };
const FACTOR = { LAM: 0.75, MET: 1.0, HDPE: 1.3, COMP: 1.6, INOX: 2.1 };
for (const [base, cents] of Object.entries(BASE)) {
  for (const [suf, f] of Object.entries(FACTOR)) {
    P[`${base}-${suf}`] = Math.round(cents * f);
  }
}

for (const [sku, cents] of Object.entries(P)) {
  await sql`update catalog_items set unit_price_cents = ${cents}, updated_at = now() where sku = ${sku}`;
}
console.log(`Precios de EJEMPLO cargados en ${Object.keys(P).length} piezas.`);
await sql.end();
