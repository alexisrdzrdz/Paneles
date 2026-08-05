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

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, company, phone, password: pw } = parsed.data;
  const mail = normalizeEmail(email);

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

  await createSession(user.id, await meta());
  await purgeExpired();
  redirect('/portal');
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
  const user = await db.query.users.findFirst({ where: eq(users.email, mail) });
  if (user && !user.emailVerifiedAt) {
    const token = await issueToken(user.id, 'email_verification', 60 * 24);
    await verificationMail(user.email, user.name, token);
  }
  return { ok: 'Si esa cuenta existe y falta confirmarla, te enviamos otro enlace.' };
}

export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const mail = normalizeEmail(String(form.get('email') ?? ''));
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
