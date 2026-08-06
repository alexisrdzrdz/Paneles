import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL (copia .env.example a .env.local)');

/* En desarrollo Next recarga los módulos en cada cambio; sin este caché cada
   recarga abriría un pool nuevo hasta agotar las conexiones de Postgres. */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
/* Con un pooler tipo pgbouncer (Neon usa hosts "-pooler") los prepared
   statements no sobreviven entre conexiones: se apagan solos en ese caso. */
const client = globalForDb.pg ?? postgres(url, { max: 10, prepare: !url.includes('-pooler') });
if (process.env.NODE_ENV !== 'production') globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
