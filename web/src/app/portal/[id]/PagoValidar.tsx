'use client';

import { useActionState } from 'react';
import { validarPago, type GestionState } from '@/lib/actions/quotes';

/* Botones de validación de un pago pendiente, solo staff. El rechazo pide
   el motivo ahí mismo: al cliente le llega tal cual. */
export function PagoValidar({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState<GestionState, FormData>(validarPago, {});

  if (state.ok) return <span className="chk-on">✓</span>;

  return (
    <form action={action} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="paymentId" value={paymentId} />
      {state.error && <span style={{ color: 'var(--danger)', fontSize: 'var(--fs-label)' }}>{state.error}</span>}
      <button className="lnk" type="submit" name="decision" value="confirmado"
              title="Cotejado contra el banco">Confirmar</button>
      <button className="lnk danger" type="submit" name="decision" value="rechazado"
              onClick={(e) => {
                const motivo = window.prompt('Motivo del rechazo (se le enviará al cliente):') ?? '';
                if (motivo === '' && !window.confirm('¿Rechazar sin motivo?')) { e.preventDefault(); return; }
                const form = e.currentTarget.form;
                if (form) {
                  let hidden = form.querySelector<HTMLInputElement>('input[name="nota"]');
                  if (!hidden) {
                    hidden = document.createElement('input');
                    hidden.type = 'hidden'; hidden.name = 'nota';
                    form.appendChild(hidden);
                  }
                  hidden.value = motivo;
                }
              }}>Rechazar</button>
    </form>
  );
}
