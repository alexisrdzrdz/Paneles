/* Da acceso de administrador. Crea la cuenta si no existe, o promueve la que ya
   está; deja el correo verificado para poder entrar de inmediato.
   Uso:  node scripts/admin.mjs correo@dominio.com [contraseña] */
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email.includes('@')) { console.error('Uso: node scripts/admin.mjs correo@dominio.com [contraseña]'); process.exit(1); }

/* Sin contraseña dada se genera una temporal legible pero no adivinable. */
const dada = process.argv[3];
const pass = dada || (randomBytes(9).toString('base64url').replace(/[-_]/g, 'x') + 'A1');
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const sql = postgres(env.DATABASE_URL);
const [existe] = await sql`select id, name, role from users where email = ${email}`;

if (existe) {
  await sql`update users set role = 'admin', email_verified_at = coalesce(email_verified_at, now()),
            password_hash = ${await hash(pass, ARGON)}, updated_at = now()
            where id = ${existe.id}`;
  console.log(`Cuenta existente promovida a administrador: ${email}`);
  console.log(`Contraseña ${dada ? 'actualizada a la que indicaste' : 'temporal: ' + pass}`);
} else {
  await sql`insert into users (email, password_hash, name, role, email_verified_at)
            values (${email}, ${await hash(pass, ARGON)}, ${email.split('@')[0]}, 'admin', now())`;
  console.log(`Administrador creado: ${email}`);
  console.log(`Contraseña ${dada ? 'la que indicaste' : 'temporal: ' + pass}`);
}
console.log('Entra en http://localhost:3000/entrar  →  luego http://localhost:3000/admin');
if (!dada) console.log('Cámbiala desde «Olvidé mi contraseña» cuando entres.');
await sql.end();
