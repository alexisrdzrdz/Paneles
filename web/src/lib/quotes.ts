import type { QuoteStatus } from '@/db/schema';

/* El cliente no lee 'in_production'. Cada estado se muestra con su nombre en
   claro y una explicación de qué significa para él. */
export const STATUS: Record<QuoteStatus, { label: string; hint: string; tone: string }> = {
  draft:         { label: 'Borrador',        hint: 'Todavía lo estás armando.',                 tone: '' },
  submitted:     { label: 'Enviado',         hint: 'Lo recibimos y entra a revisión.',          tone: 'ui-badge-info' },
  reviewing:     { label: 'En revisión',     hint: 'Estamos verificando medidas y materiales.', tone: 'ui-badge-info' },
  quoted:        { label: 'Cotizado',        hint: 'Ya tienes precio en firme.',                tone: 'ui-badge-info' },
  approved:      { label: 'Aprobado',        hint: 'Aceptaste la cotización.',                  tone: 'ui-badge-ok' },
  in_production: { label: 'En fabricación',  hint: 'Tu pedido se está produciendo.',            tone: 'ui-badge-ok' },
  shipped:       { label: 'Enviado a obra',  hint: 'Va en camino.',                             tone: 'ui-badge-ok' },
  delivered:     { label: 'Entregado',       hint: 'Proyecto cerrado.',                         tone: 'ui-badge-ok' },
  cancelled:     { label: 'Cancelado',       hint: 'Este proyecto no continuó.',                tone: 'ui-badge-danger' },
};

/* Orden real del avance, para dibujar la barra de seguimiento. `cancelled`
   queda fuera a propósito: no es un paso, es una salida. */
export const FLOW: QuoteStatus[] = [
  'draft', 'submitted', 'reviewing', 'quoted', 'approved', 'in_production', 'shipped', 'delivered',
];

export const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(cents / 100);

export const when = (d: Date) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(d);

/* Techo de dinero: cabe en el integer de Postgres con margen. Un monto por
   encima es dedazo, no un pedido de $21 millones. */
export const MAX_CENTS = 2_000_000_000;

/* Convierte lo que teclea una persona ("$1,500.50", "20,000", "1.500,50") a
   centavos enteros, o null si no se entiende. Regla: el último separador
   seguido de 1–2 dígitos es el decimal; cualquier otro punto o coma es de
   millares y se descarta. Así "20,000" son veinte mil y "1500,50" son mil
   quinientos con cincuenta, sin que la coma multiplique por cien. */
export function parsePesosToCents(raw: string): number | null {
  const s = String(raw).trim().replace(/[$\s]/g, '');
  if (!s || !/^[0-9.,]+$/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let intPart: string, decPart: string;
  if (lastSep === -1) {
    intPart = s; decPart = '';
  } else {
    const after = s.slice(lastSep + 1);
    if (after.length >= 1 && after.length <= 2) {   // separador decimal
      intPart = s.slice(0, lastSep).replace(/[.,]/g, '');
      decPart = after;
    } else {                                          // separador de millares
      intPart = s.replace(/[.,]/g, '');
      decPart = '';
    }
  }
  if (!/^\d+$/.test(intPart)) return null;
  const cents = parseInt(intPart, 10) * 100 + (decPart ? parseInt(decPart.padEnd(2, '0'), 10) : 0);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

/* UUID canónico 8-4-4-4-12. La regex laxa dejaba pasar cadenas que Postgres
   rechaza con un 500 en vez del 404 que se pretende. */
export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* Folio legible y estable: BETA-000128. El consecutivo lo da la base. */
export const reference = (n: number) => `BETA-${String(n).padStart(6, '0')}`;
