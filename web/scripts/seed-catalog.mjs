/* Estructura del tabulador: piezas y reglas de armado. Los datos viven en
   catalogo-datos.mjs (compartidos con el asistente de instalación).
   Uso:  npm run seed:catalog */
import { sembrarCatalogo } from './catalogo-datos.mjs';
import { conectar } from './db.mjs';

const sql = conectar();

const { piezas, reglas } = await sembrarCatalogo(sql);
console.log(`Tabulador sembrado: ${piezas} piezas, ${reglas} reglas.`);
console.log('⚠  Todos los precios están en $0. Captúralos desde el panel de administración.');
await sql.end();
