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

/* Folio legible y estable: BETA-000128. El consecutivo lo da la base. */
export const reference = (n: number) => `BETA-${String(n).padStart(6, '0')}`;
