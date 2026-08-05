import {
  pgTable, uuid, text, timestamp, integer, jsonb, index, pgEnum, boolean,
} from 'drizzle-orm/pg-core';

/* ── Cuentas ────────────────────────────────────────────────────────────
   El rol vive en el usuario. Un solo enum evita el clásico `isAdmin` que
   luego no sabe qué hacer cuando aparece un tercer rol (ventas, taller). */
export const userRole = pgEnum('user_role', ['customer', 'staff', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /* Siempre en minúsculas: el correo se normaliza antes de escribir, así el
     índice único de verdad impide "Ana@x.com" y "ana@x.com" a la vez. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  company: text('company'),
  role: userRole('role').notNull().default('customer'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* La sesión se guarda HASHEADA: si alguien lee la base, no puede suplantar a
   nadie con lo que encuentre ahí. El id es sha256(token de la cookie). */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  userAgent: text('user_agent'),
  ip: text('ip'),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

/* Verificación de correo y recuperación de contraseña comparten forma; el
   propósito las distingue en vez de duplicar dos tablas casi idénticas. */
export const tokenPurpose = pgEnum('token_purpose', ['email_verification', 'password_reset']);

export const authTokens = pgTable('auth_tokens', {
  id: text('id').primaryKey(),                    // sha256 del token enviado por correo
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: tokenPurpose('purpose').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('auth_tokens_user_idx').on(t.userId, t.purpose)]);

/* ── Proyectos del cliente ──────────────────────────────────────────────
   Un "quote" es lo que el cotizador produce. `payload` guarda el estado
   completo del configurador para poder reabrirlo tal cual; `totalCents`
   se materializa aparte porque los listados y los reportes no deben tener
   que interpretar el JSON para saber cuánto vale. */
export const quoteStatus = pgEnum('quote_status', [
  'draft',          // el cliente aún lo está armando
  'submitted',      // pidió cotización formal
  'reviewing',      // Mauricios lo está revisando
  'quoted',         // hay precio en firme
  'approved',       // el cliente aceptó
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
]);

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /* Folio legible para el cliente y para el teléfono: "MAU-000128". */
  reference: text('reference').notNull().unique(),
  name: text('name').notNull(),
  status: quoteStatus('status').notNull().default('draft'),
  payload: jsonb('payload').notNull(),
  /* Centavos enteros. Nunca float para dinero. */
  totalCents: integer('total_cents').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  materialId: text('material_id'),
  unitCount: integer('unit_count').notNull().default(0),
  /* Token opcional para compartir por enlace sin exigir cuenta. */
  shareToken: text('share_token').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('quotes_user_idx').on(t.userId, t.updatedAt),
  index('quotes_status_idx').on(t.status),
]);

/* ── Seguimiento ────────────────────────────────────────────────────────
   El historial es una bitácora append-only, no un campo que se sobrescribe.
   Así el cliente ve *cuándo* pasó cada cosa y quién la hizo, y nunca se
   pierde el rastro al cambiar de estado. */
export const quoteEventType = pgEnum('quote_event_type', [
  'created', 'updated', 'submitted', 'status_changed', 'note', 'file',
]);

export const quoteEvents = pgTable('quote_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  type: quoteEventType('type').notNull(),
  fromStatus: quoteStatus('from_status'),
  toStatus: quoteStatus('to_status'),
  message: text('message'),
  /* Quién lo hizo. Nulo = el sistema. Se conserva el evento aunque el
     usuario se borre, porque el historial no debe quedar con huecos. */
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  /* Los eventos internos no se le muestran al cliente en su portal. */
  visibleToCustomer: boolean('visible_to_customer').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('quote_events_quote_idx').on(t.quoteId, t.createdAt)]);

export type User = typeof users.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
