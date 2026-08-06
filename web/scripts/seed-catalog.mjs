/* Estructura del tabulador: piezas y reglas de armado. Los datos viven en
   catalogo-datos.mjs (compartidos con el asistente de instalación).
   Uso:  npm run seed:catalog */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { sembrarCatalogo } from './catalogo-datos.mjs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);
const sql = postgres(process.env.DATABASE_URL || env.DATABASE_URL);

const { piezas, reglas } = await sembrarCatalogo(sql);
console.log(`Tabulador sembrado: ${piezas} piezas, ${reglas} reglas.`);
console.log('⚠  Todos los precios están en $0. Captúralos desde el panel de administración.');
await sql.end();
