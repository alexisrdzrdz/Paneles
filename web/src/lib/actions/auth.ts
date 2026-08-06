'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  issueToken, consumeToken, normalizeEmail, purgeExpired,
  rateLimit, clearRateLimit,
} from '@/lib/auth';
import { verificationMail, passwordResetMail } from '@/lib/mail';

export type FormState = { error?: string; ok?: string };

const password = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(200, 'Contraseña demasiado larga');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  email: z.string().trim().email('Ese correo no parece válido').max(200),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  password,
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Las dos contraseñas no coinciden', path: ['confirm'],
});

async function meta() {
  const h = await headers();
  return {
    userAgent: h.get('user-agent') ?? undefined,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  };
}

/* Mismo mensaje para cualquier tope: no dice cuál se alcanzó ni de cuánto
   es, porque esa información solo le sirve a quien está probando límites. */
const TOO_MANY = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, company, phone, password: pw } = parsed.data;
  const mail = normalizeEmail(email);

  /* Crear cuentas manda correo: sin tope, una IP podría llenar la base de
     cuentas basura y quemar la reputación del remitente. */
  const m = await meta();
  if (m.ip && !(await rateLimit(`registro:ip:${m.ip}`, 10, 60))) {
    return { error: TOO_MANY };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, mail) });
  if (existing) {
    /* No se revela si el correo ya tiene cuenta: eso permitiría enumerar
       clientes. Se responde igual que en el alta buena y, si la cuenta
       existe, se le manda un aviso a su dueño. */
    return { ok: 'Revisa tu correo: te enviamos el enlace de confirmación.' };
  }

  const [user] = await db.insert(users).values({
    email: mail, name, company: company || null, phone: phone || null,
    passwordHash: await hashPassword(pw),
  }).returning();

  const token = await issueToken(user.id, 'email_verification', 60 * 24);
  await verificationMail(mail, name, token);
  return { ok: 'Cuenta creada. Revisa tu correo para confirmarla.' };
}

const loginSchema = z.object({
  email: z.string().trim().email('Correo o contraseña incorrectos'),
  password: z.string().min(1, 'Correo o contraseña incorrectos'),
});

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Correo o contraseña incorrectos' };

  const mail = normalizeEmail(parsed.data.email);

  /* El tope va antes de tocar la base o la contraseña. Por IP frena al que
     rota correos; por correo, al que rota IPs contra una misma cuenta. La
     llave usa el correo tecleado exista o no la cuenta, así el mensaje de
     tope tampoco delata quién está registrado. */
  const m = await meta();
  const allowed = await Promise.all([
    m.ip ? rateLimit(`login:ip:${m.ip}`, 20, 15) : true,
    rateLimit(`login:correo:${mail}`, 8, 15),
  ]);
  if (allowed.includes(false)) return { error: TOO_MANY };

  const user = await db.query.users.findFirst({ where: eq(users.email, mail) });

  /* Mismo mensaje exista o no la cuenta, para no delatar qué correos hay
     registrados. Y se verifica igual contra un hash señuelo para que el
     tiempo de respuesta no lo delate tampoco. */
  const stored = user?.passwordHash
    ?? '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2E$0000000000000000000000000000000000000000000';
  const ok = await verifyPassword(stored, parsed.data.password);
  if (!user || !ok) return { error: 'Correo o contraseña incorrectos' };

  if (!user.emailVerifiedAt) {
    return { error: 'Todavía no confirmas tu correo. Revisa tu bandeja o pide otro enlace.' };
  }

  /* Se perdona solo el contador de la cuenta; el de la IP sigue contando. */
  await clearRateLimit(`login:correo:${mail}`);
  await createSession(user.id, m);
  await purgeExpired();

  /* `next` regresa a quien venía de en medio de algo (p. ej. el cotizador con
     una solicitud lista). Solo rutas propias: nada de mandar a otro dominio. */
  const next = String(form.get('next') ?? '');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/portal');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, 'email_verification');
  if (!userId) return false;
  await db.update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
  await createSession(userId, await meta());   // confirmar ya deja la sesión lista
  return true;
}

export async function resendVerification(_prev: FormState, form: FormData): Promise<FormState> {
  const mail = normalizeEmail(String(form.get('email') ?? ''));

  /* El tope por buzón evita que alguien use el formulario para inundar el
     correo de un cliente; el de IP, que lo intente con muchos buzones. */
  const m = await meta();
  const allowed = await Promise.all([
    m.ip ? rateLimit(`reenviar:ip:${m.ip}`, 10, 15) : true,
    rateLimit(`reenviar:correo:${mail}`, 3, 15),
  ]);
  if (allowed.includes(false)) return { error: TOO_MANY };

  const user = await db.query.users.findFirst({ where: eq(users.email, mail) });
  if (user && !user.emailVerifiedAt) {
    const token = await issueToken(user.id, 'email_verification', 60 * 24);
    await verificationMail(user.email, user.name, token);
  }
  return { ok: 'Si esa cuenta existe y falta confirmarla, te enviamos otro enlace.' };
}

export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const mail = normalizeEmail(String(form.get('email') ?? ''));

  const m = await meta();
  const allowed = await Promise.all([
    m.ip ? rateLimit(`recuperar:ip:${m.ip}`, 10, 15) : true,
    rateLimit(`recuperar:correo:${mail}`, 3, 15),
  ]);
  if (allowed.includes(false)) return { error: TOO_MANY };

  const user = await db.query.users.findFirst({ where: eq(users.email, mail) });
  if (user) {
    const token = await issueToken(user.id, 'password_reset', 60);
    await passwordResetMail(user.email, user.name, token);
  }
  return { ok: 'Si esa cuenta existe, te enviamos un enlace para cambiar la contraseña.' };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password,
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Las dos contraseñas no coinciden', path: ['confirm'],
});

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const userId = await consumeToken(parsed.data.token, 'password_reset');
  if (!userId) return { error: 'Ese enlace ya caducó o se usó. Pide uno nuevo.' };

  await db.update(users).set({
    passwordHash: await hashPassword(parsed.data.password),
    /* Cambiar la contraseña confirma el correo de paso: llegó ahí. */
    emailVerifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  await createSession(userId, await meta());
  redirect('/portal');
}
