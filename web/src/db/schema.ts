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

/* ── Tabulador ──────────────────────────────────────────────────────────
   El catálogo que el administrador edita. De aquí sale TODO el precio: no
   quedan números sueltos en el código. Cada pieza dice cómo se vende y qué
   pasa cuando el proyecto no cae justo en una medida comercial. */

export const itemCategory = pgEnum('item_category', [
  'panel',      // divisiones, frentes, paneles de fondo
  'puerta',
  'pilastra',
  'mampara',    // mingitorios
  'bisagra', 'cerradura', 'jaladera', 'gancho', 'escuadra', 'zapata', 'riel',
  'tornilleria',// tornillos, taquetes, pijas
  'corte',      // cargo por corte / maquinado
  'mano_obra',
  'flete',
  'otro',
]);

/* Cómo se vende la pieza. Determina qué significa `unitPriceCents`. */
export const pricingMode = pgEnum('pricing_mode', [
  'pieza',      // precio por unidad
  'longitud',   // precio por metro lineal
  'area',       // precio por metro cuadrado
  'hora',       // precio por hora (mano de obra)
]);

/* Qué se cobra cuando lo que necesitas no cae en una medida comercial.
   `pieza_completa` es el caso que importa: si el panel viene de 6 m y
   necesitas 6.25, se cobran 2 piezas (12 m), no 6.25. */
export const wastePolicy = pgEnum('waste_policy', [
  'exacto',          // se cobra justo lo que se usa
  'pieza_completa',  // se cobran piezas comerciales enteras
  'redondeo_arriba', // se redondea a la unidad de venta (p. ej. metro entero)
]);

export const catalogItems = pgTable('catalog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: itemCategory('category').notNull(),
  pricingMode: pricingMode('pricing_mode').notNull().default('pieza'),
  /* Centavos. Por pieza, por metro, por m² o por hora según `pricingMode`. */
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  /* Medida comercial en la que se surte. Sin ella, `pieza_completa` no aplica. */
  stockLengthMm: integer('stock_length_mm'),
  stockWidthMm: integer('stock_width_mm'),
  wastePolicy: wastePolicy('waste_policy').notNull().default('exacto'),
  /* Si la pieza solo existe para cierto material (p. ej. panel de HDPE). */
  materialId: text('material_id'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('catalog_category_idx').on(t.category, t.active)]);

/* A qué se engancha cada pieza. Una cabina lleva 2 bisagras; una frontera
   lleva pilastra + zapata + taquetes; una hilera lleva riel. */
export const ruleTarget = pgEnum('rule_target', [
  'cabina',           // por cada cabina de inodoro
  'mingitorio',       // por cada mingitorio
  'puerta',           // por cada puerta
  'division_alta',    // por cada frontera con panel completo
  'division_corta',   // por cada frontera entre mingitorios
  'hilera',           // por cada hilera
  'panel_fondo',      // por el fondo, cuando se cotiza
  'proyecto',         // una vez por cotización
]);

/* Cómo se calcula la cantidad a partir de la geometría. */
export const qtyBasis = pgEnum('qty_basis', [
  'fija',        // qty tal cual (2 bisagras)
  'por_mm',      // qty × (longitud del objetivo en mm / 1000) → metros
  'por_mm2',     // qty × (área del objetivo en mm² / 1e6) → m²
]);

export const assemblyRules = pgTable('assembly_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => catalogItems.id, { onDelete: 'cascade' }),
  target: ruleTarget('target').notNull(),
  basis: qtyBasis('basis').notNull().default('fija'),
  /* Multiplicador. Con basis 'fija' es la cantidad; con 'por_mm' es cuántas
     unidades por metro (normalmente 1). Se guarda ×1000 para no usar float. */
  qtyMilli: integer('qty_milli').notNull().default(1000),
  /* Solo aplica si la unidad es de este material (nulo = cualquiera). */
  materialId: text('material_id'),
  active: boolean('active').notNull().default(true),
}, (t) => [index('assembly_rules_target_idx').on(t.target, t.active)]);

/* El desglose materializado de una cotización. Se guarda con los precios del
   día: si mañana sube el acero, la cotización vieja no cambia sola. */
export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  category: itemCategory('category').notNull(),
  /* Lo que el proyecto realmente necesita y lo que se termina cobrando:
     con `pieza_completa` no coinciden, y el cliente merece ver la diferencia. */
  neededMilli: integer('needed_milli').notNull(),
  billedMilli: integer('billed_milli').notNull(),
  unit: text('unit').notNull(),               // 'pz', 'm', 'm²', 'h'
  unitPriceCents: integer('unit_price_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('quote_lines_quote_idx').on(t.quoteId, t.sortOrder)]);

export type CatalogItem = typeof catalogItems.$inferSelect;
export type AssemblyRule = typeof assemblyRules.$inferSelect;
export type QuoteLine = typeof quoteLines.$inferSelect;

export type User = typeof users.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
