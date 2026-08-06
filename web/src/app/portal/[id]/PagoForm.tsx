'use client';

import { useActionState } from 'react';
import { registrarPago, type GestionState } from '@/lib/actions/quotes';
import { Submit, Notice } from '@/components/Field';

const METODOS = [
  ['transferencia', 'Transferencia'], ['deposito', 'Depósito'],
  ['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['otro', 'Otro'],
] as const;

/* Captura de pagos, solo staff. Un monto negativo corrige un error de dedo
   sin borrar historia: el estado de cuenta siempre suma lo que pasó. */
export function PagoForm({ quoteId }: { quoteId: string }) {
  const [state, action] = useActionState<GestionState, FormData>(registrarPago, {});
  return (
    <details className="pago-form">
      <summary className="ui-btn">Registrar pago</summary>
      <Notice state={state} />
      <form action={action} className="gestion-form" style={{ marginTop: 'var(--space-3)' }}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <div className="ui-field"><label>Monto (pesos)</label>
          <input name="monto" inputMode="decimal" required placeholder="p. ej. 20,000" /></div>
        <div className="ui-field"><label>Método</label>
          <select name="metodo" defaultValue="transferencia">
            {METODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="ui-field"><label>Referencia (opcional)</label>
          <input name="referencia" placeholder="Folio o últimos 4 dígitos" /></div>
        <div className="ui-field"><label>Nota (opcional)</label>
          <input name="nota" placeholder="Anticipo 50%…" /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Submit>Guardar pago y avisar al cliente</Submit>
        </div>
      </form>
    </details>
  );
}
