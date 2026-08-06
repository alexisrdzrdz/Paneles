import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { eq, and, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, sessions, authTokens, rateLimits, type User } from '@/db/schema';

export const SESSION_COOKIE = 'mp_session';
const SESSION_DAYS = 30;

/* Argon2id con parámetros de OWASP. Deliberadamente lento: es lo único que
   separa una fuga de la base de las contraseñas reales de los clientes. */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argonHash(plain, ARGON);

export async function verifyPassword(storedHash: string, plain: string) {
  try {
    return await argonVerify(storedHash, plain, ARGON);
  } catch {
    return false; // hash corrupto o de otro algoritmo: no es una excepción, es un "no"
  }
}

/* El token viaja al cliente; en la base solo queda su sha256. Leer la tabla
   de sesiones no alcanza para suplantar a nadie. */
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/* Comparación en tiempo constante para tokens de un solo uso. */
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({
    id: sha256(token), userId, expiresAt,
    userAgent: meta?.userAgent?.slice(0, 300) ?? null,
    ip: meta?.ip ?? null,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/* Devuelve el usuario de la petición actual, o null. No lanza: las páginas
   públicas la llaman para decidir qué enseñar. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, sha256(token)) });
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  return user ?? null;
}

export const isAdmin = (u: User | null) => u?.role === 'admin' || u?.role === 'staff';

/* ── Tokens de correo (verificación y recuperación) ────────────────────
   Se emite uno nuevo invalidando los anteriores del mismo propósito, para
   que un enlace viejo reenviado por error no siga sirviendo. */
export async function issueToken(
  userId: string,
  purpose: 'email_verification' | 'password_reset',
  ttlMinutes: number,
) {
  await db.delete(authTokens).where(
    and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)),
  );
  const token = newToken();
  await db.insert(authTokens).values({
    id: sha256(token), userId, purpose,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  });
  return token;
}

export async function consumeToken(
  token: string,
  purpose: 'email_verification' | 'password_reset',
) {
  const row = await db.query.authTokens.findFirst({ where: eq(authTokens.id, sha256(token)) });
  if (!row || row.purpose !== purpose) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.delete(authTokens).where(eq(authTokens.id, row.id));
  return row.userId;
}

/* ── Freno de intentos ─────────────────────────────────────────────────
   Ventana fija: cuenta intentos por llave y devuelve si aún hay cupo. El
   upsert con CASE decide dentro de la base si la ventana ya venció, así
   dos peticiones simultáneas no leen el mismo conteo y se saltan el tope. */
export async function rateLimit(key: string, max: number, windowMinutes: number) {
  const resetAt = new Date(Date.now() + windowMinutes * 60_000);
  const [row] = await db.insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then excluded.reset_at else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  return row.count <= max;
}

/* Al entrar bien se perdona el contador de esa cuenta: quien recuerda su
   contraseña al tercer intento no debe cargar con los intentos fallidos. */
export const clearRateLimit = (key: string) =>
  db.delete(rateLimits).where(eq(rateLimits.key, key));

/* Higiene: borra sesiones, tokens y contadores vencidos. Se llama de forma
   oportunista. */
export async function purgeExpired() {
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(authTokens).where(lt(authTokens.expiresAt, now));
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
}
