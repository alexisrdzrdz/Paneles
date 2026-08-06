/* Datos de prueba: un cliente verificado, un administrador y un proyecto con
   su bitácora, para poder ver el portal con contenido real.
   Uso:  npm run seed   (borra y recrea SOLO estas cuentas de ejemplo) */
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);

const sql = postgres(env.DATABASE_URL);
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const pw = await hash('Prueba1234', ARGON);

const CLIENTE = 'cliente@ejemplo.com';
const ADMIN = 'admin@betaparticiones.com';

await sql`delete from users where email in (${CLIENTE}, ${ADMIN})`;

const [cliente] = await sql`
  insert into users (email, password_hash, name, company, role, email_verified_at)
  values (${CLIENTE}, ${pw}, 'Ana Robles', 'Constructora Robles', 'customer', now())
  returning id`;

await sql`
  insert into users (email, password_hash, name, role, email_verified_at)
  values (${ADMIN}, ${pw}, 'Admin Beta', 'admin', now())`;

const [q] = await sql`
  insert into quotes (user_id, reference, name, status, payload, total_cents, material_id, unit_count)
  values (${cliente.id}, 'BETA-000101', 'Baño planta baja · Torre Sur', 'in_production',
          ${sql.json({ demo: true })}, 505500, 'hdpe', 7)
  returning id`;

const bitacora = [
  ['created',        null,            'Cotización creada desde el configurador.', -18],
  ['submitted',      'submitted',     'Solicitaste cotización formal.',           -15],
  ['status_changed', 'reviewing',     'Revisamos medidas y disponibilidad.',      -13],
  ['status_changed', 'quoted',        'Precio en firme enviado a tu correo.',     -10],
  ['status_changed', 'approved',      'Aprobaste la cotización.',                 -6],
  ['status_changed', 'in_production', 'Tu pedido entró a fabricación.',           -2],
];
for (const [type, to, msg, dias] of bitacora) {
  await sql`
    insert into quote_events (quote_id, type, to_status, message, created_at)
    values (${q.id}, ${type}, ${to}, ${msg}, now() + ${`${dias} days`}::interval)`;
}

await sql`
  insert into quotes (user_id, reference, name, status, payload, total_cents, material_id, unit_count)
  values (${cliente.id}, 'BETA-000102', 'Baño de visitas · Oficinas', 'draft',
          ${sql.json({ demo: true })}, 244000, 'laminado', 3)`;

console.log('Sembrado listo.');
console.log(`  cliente: ${CLIENTE} / Prueba1234`);
console.log(`  admin:   ${ADMIN} / Prueba1234`);
await sql.end();
