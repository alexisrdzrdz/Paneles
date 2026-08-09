'use client';

import { useActionState } from 'react';
import { cambiarEstado, type GestionState } from '@/lib/actions/quotes';
import { Submit, Notice } from '@/components/Field';
import { STATUS } from '@/lib/quotes';
import type { QuoteStatus } from '@/db/schema';

const OPCIONES: QuoteStatus[] = [
  'submitted', 'reviewing', 'quoted', 'approved', 'in_production', 'shipped', 'delivered', 'cancelled',
];

/* Bloque de gestión que solo ve el staff, encima del detalle del cliente.
   Un solo formulario hace las tres cosas del día a día: mover el estado,
   poner el total en firme y dejarle un mensaje al cliente. */
export function Gestion({ quoteId, estado }: { quoteId: string; estado: QuoteStatus }) {
  const [state, action] = useActionState<GestionState, FormData>(cambiarEstado, {});
  return (
    <div className="ui-panel" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="ui-panel-head">
        <span className="ui-panel-title">Gestión</span>
        <span className="ui-panel-meta">SOLO STAFF</span>
      </div>
      <div className="ui-panel-body">
        <Notice state={state} />
        <form action={action} className="gestion-form">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="ui-field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={estado}>
              {OPCIONES.map((s) => (
                <option key={s} value={s}>{STATUS[s].label}</option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="total">Total en firme (opcional)</label>
            <input id="total" name="total" inputMode="decimal" placeholder="p. ej. 48,500" />
          </div>
          <div className="ui-field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="mensaje">Mensaje para el cliente (opcional)</label>
            <textarea id="mensaje" name="mensaje" rows={2}
              placeholder="Se ve en la conversación del proyecto, en su portal." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Submit>Guardar y avisar</Submit>
          </div>
        </form>
      </div>
    </div>
  );
}
