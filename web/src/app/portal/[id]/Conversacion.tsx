'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { enviarMensaje, type GestionState } from '@/lib/actions/quotes';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button className="ui-btn ui-btn-primary" type="submit" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar'}
    </button>
  );
}

/* Caja para escribir en la conversación del proyecto. La usa el cliente y el
   vendedor: todo queda en el mismo hilo, dentro del sistema. Se limpia sola
   al enviar. */
export function Conversacion({ quoteId, esStaff }: { quoteId: string; esStaff: boolean }) {
  const [state, action] = useActionState<GestionState, FormData>(enviarMensaje, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={action} className="conv-form">
      {state.error && <div className="ui-alert ui-alert-danger" style={{ marginBottom: 'var(--space-2)' }}>{state.error}</div>}
      <input type="hidden" name="quoteId" value={quoteId} />
      <textarea name="texto" rows={2} required maxLength={2000}
        placeholder={esStaff ? 'Responde al cliente…' : 'Escríbenos aquí lo que necesites…'} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Enviar />
      </div>
    </form>
  );
}
