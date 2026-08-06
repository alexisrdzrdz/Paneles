'use client';

import { useActionState, useState } from 'react';
import { guardarDireccion, type GestionState, type Direccion as Dir } from '@/lib/actions/quotes';
import { Submit, Notice } from '@/components/Field';

/* La dirección vive en una tarjeta del costado. Si ya hay una, se muestra en
   claro con un botón para cambiarla; el formulario solo aparece cuando hace
   falta, que es como piensa un cliente: "¿a dónde lo mando?" una sola vez. */
export function Direccion({ quoteId, actual, editable }: {
  quoteId: string; actual: Dir | null; editable: boolean;
}) {
  const [state, action] = useActionState<GestionState, FormData>(guardarDireccion, {});
  const [editando, setEditando] = useState(false);

  const abierta = editando || (!actual && editable);

  return (
    <div style={{
      border: 'var(--border-width) solid var(--line)', borderRadius: 'var(--radius-md)',
      background: 'var(--surface)', padding: 'var(--space-4)', marginTop: 'var(--space-3)',
    }}>
      <h2 style={{ fontSize: 14, marginTop: 0, color: 'var(--ink-dim)' }}>Dirección de envío</h2>
      <Notice state={state} />

      {!abierta && actual && (
        <div style={{ fontSize: 'var(--fs-label)', lineHeight: 1.7 }}>
          <div>{actual.calle}</div>
          {actual.colonia && <div>{actual.colonia}</div>}
          <div>{actual.ciudad}, {actual.estado} · CP {actual.cp}</div>
          {actual.contacto && <div style={{ color: 'var(--ink-dim)' }}>Recibe: {actual.contacto}{actual.telefono ? ` · ${actual.telefono}` : ''}</div>}
          {actual.notas && <div style={{ color: 'var(--ink-dim)' }}>{actual.notas}</div>}
          {editable && (
            <button className="ui-btn" type="button" style={{ marginTop: 'var(--space-2)' }}
                    onClick={() => setEditando(true)}>Cambiar dirección</button>
          )}
        </div>
      )}

      {!abierta && !actual && (
        <p style={{ margin: 0, color: 'var(--ink-dim)', fontSize: 'var(--fs-label)' }}>
          Sin dirección todavía.
        </p>
      )}

      {abierta && (
        <form action={action} className="ui-form" style={{ gap: 'var(--space-2)' }}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="ui-field"><label>Calle y número</label>
            <input name="calle" defaultValue={actual?.calle ?? ''} required placeholder="Av. Industria 240, bodega 3" /></div>
          <div className="ui-field"><label>Colonia (opcional)</label>
            <input name="colonia" defaultValue={actual?.colonia ?? ''} /></div>
          <div className="ui-form two" style={{ gap: 'var(--space-2)' }}>
            <div className="ui-field"><label>Ciudad</label>
              <input name="ciudad" defaultValue={actual?.ciudad ?? ''} required /></div>
            <div className="ui-field"><label>Estado</label>
              <input name="estado" defaultValue={actual?.estado ?? ''} required /></div>
          </div>
          <div className="ui-form two" style={{ gap: 'var(--space-2)' }}>
            <div className="ui-field"><label>Código postal</label>
              <input name="cp" defaultValue={actual?.cp ?? ''} required inputMode="numeric" maxLength={5} placeholder="64000" /></div>
            <div className="ui-field"><label>Teléfono (opcional)</label>
              <input name="telefono" defaultValue={actual?.telefono ?? ''} type="tel" /></div>
          </div>
          <div className="ui-field"><label>Quién recibe (opcional)</label>
            <input name="contacto" defaultValue={actual?.contacto ?? ''} placeholder="Nombre en obra" /></div>
          <div className="ui-field"><label>Indicaciones (opcional)</label>
            <input name="notas" defaultValue={actual?.notas ?? ''} placeholder="Horario, acceso de camión…" /></div>
          <Submit>Guardar dirección</Submit>
        </form>
      )}
    </div>
  );
}
