/* Conexión a la base para TODOS los scripts. La variable de entorno
   DATABASE_URL manda (así se corre contra producción o en CI); si no está,
   se lee web/.env.local — y si tampoco existe el archivo, error claro en
   lugar de un ENOENT críptico. */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

export function conectar() {
  let env = {};
  try {
    env = Object.fromEntries(
      readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
    );
  } catch { /* sin .env.local: solo variables de entorno */ }

  const url = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL: expórtala en el entorno o crea web/.env.local.');
    process.exit(1);
  }
  return postgres(url);
}
