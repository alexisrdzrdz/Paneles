'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { decidir, type GestionState } from '@/lib/actions/quotes';
import { Notice } from '@/components/Field';

function Botones() {
  const { pending } = useFormStatus();
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <button className="ui-btn ui-btn-primary" type="submit" name="decision" value="approved"
              disabled={pending}>
        {pending ? 'Un momento…' : 'Aprobar cotización'}
      </button>
      <button className="ui-btn" type="submit" name="decision" value="cancelled" disabled={pending}
              onClick={(e) => { if (!confirm('¿Seguro que no quieres continuar con este proyecto?')) e.preventDefault(); }}>
        No continuar
      </button>
    </div>
  );
}

/* El momento de la verdad del portal: hay precio en firme y la decisión es
   del cliente. Dos botones, sin letras chiquitas. */
export function Decision({ quoteId, totalTxt }: { quoteId: string; totalTxt: string }) {
  const [state, action] = useActionState<GestionState, FormData>(decidir, {});
  return (
    <div className="ui-alert ui-alert-info" style={{ marginBottom: 'var(--space-4)' }}>
      <p style={{ margin: '0 0 var(--space-2)' }}>
        <b>Tu cotización está lista: {totalTxt}.</b> Si estás de acuerdo, apruébala y
        pasa a fabricación. Si algo no cuadra, escríbenos por WhatsApp o teléfono antes de decidir.
      </p>
      <Notice state={state} />
      {!state.ok && (
        <form action={action}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <Botones />
        </form>
      )}
    </div>
  );
}
