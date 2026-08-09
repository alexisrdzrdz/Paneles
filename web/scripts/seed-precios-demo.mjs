/* Precios DE EJEMPLO para probar la calculadora. NO son reales.
   Uso:  npm run seed:precios-demo */
import { conectar } from './db.mjs';
const sql = conectar();

/* Piezas comunes (centavos). */
const P = { 'BISAGRA':8550, 'CERRADURA':14000, 'JALADERA':6500, 'GANCHO':4500,
  'ESCUADRA':3800, 'ZAPATA':9500, 'TAQUETE':350, 'TORNILLO':180, 'PIJA':220,
  'EMPAQUE-P':12000, 'EMPAQUE-U':2800, 'SELLO':9500, 'CORTE':5500, 'INSTALACION':32000,
  'FLETE':180000, 'RIEL':41000, 'TIRA-PRIV':15000, 'KIT-ADA':65000 };

/* Piezas por material: precio base × factor del material, para que la
   comparación del cotizador tenga sentido desde el primer día.
   OJO: HOJA se vende por ÁREA — su precio es POR M², no por hoja completa
   (la hoja de 3 × 1.5 m son 4.5 m²; el motor multiplica por los m²). */
const BASE = { 'HOJA':28000, 'PANEL-FONDO':38000, 'PUERTA':210000, 'PILASTRA':89000, 'MAMPARA':76000 };
const FACTOR = { LAM: 0.75, MET: 1.0, HDPE: 1.3, COMP: 1.6, INOX: 2.1 };
for (const [base, cents] of Object.entries(BASE)) {
  for (const [suf, f] of Object.entries(FACTOR)) {
    P[`${base}-${suf}`] = Math.round(cents * f);
  }
}

/* Un update que no encuentra su SKU es un error silencioso: se avisa. */
let ok = 0;
for (const [sku, cents] of Object.entries(P)) {
  const r = await sql`update catalog_items set unit_price_cents = ${cents}, updated_at = now() where sku = ${sku}`;
  if (r.count === 0) console.warn(`⚠  SKU sin renglón en el catálogo: ${sku} (¿corriste seed:catalog?)`);
  else ok++;
}
console.log(`Precios de EJEMPLO cargados en ${ok} de ${Object.keys(P).length} piezas.`);
await sql.end();
