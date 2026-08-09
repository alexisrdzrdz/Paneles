'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { validarPago, type GestionState } from '@/lib/actions/quotes';

/* Botón de submit que se deshabilita mientras el server action corre, para
   que un doble clic no dispare dos validaciones. */
function Boton({ value, danger, children }: { value: string; danger?: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={`lnk${danger ? ' danger' : ''}`} type="submit" name="decision" value={value} disabled={pending}>
      {children}
    </button>
  );
}

/* Validación de un pago pendiente, solo staff. El motivo del rechazo es
   estado de React (input controlado): nada de inyectar nodos al DOM del
   formulario, y se recorta a 300 para que el server action no lo rechace. */
export function PagoValidar({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState<GestionState, FormData>(validarPago, {});
  const [nota, setNota] = useState('');
  const [rechazando, setRechazando] = useState(false);

  if (state.ok) return <span className="chk-on" title={state.ok}>✓ validado</span>;

  return (
    <form action={action} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="nota" value={nota.slice(0, 300)} />
      {state.error && <span style={{ color: 'var(--danger)', fontSize: 'var(--fs-label)' }}>{state.error}</span>}
      {!rechazando ? (
        <>
          <Boton value="confirmado">Confirmar</Boton>
          <button className="lnk danger" type="button" onClick={() => setRechazando(true)}>Rechazar</button>
        </>
      ) : (
        <>
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300}
                 placeholder="Motivo (se le envía al cliente)"
                 style={{ fontSize: 'var(--fs-label)', padding: '2px 6px', minWidth: 180 }} />
          <Boton value="rechazado" danger>Confirmar rechazo</Boton>
          <button className="lnk" type="button" onClick={() => { setRechazando(false); setNota(''); }}>Cancelar</button>
        </>
      )}
    </form>
  );
}
