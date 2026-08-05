'use client';

import { useFormStatus } from 'react-dom';

export function Field(props: {
  label: string; name: string; type?: string;
  required?: boolean; autoComplete?: string; hint?: string; defaultValue?: string;
}) {
  const { label, hint, ...rest } = props;
  return (
    <div className="ui-field">
      <label htmlFor={rest.name}>{label}</label>
      <input id={rest.name} {...rest} />
      {hint && <small style={{ color: 'var(--ink-faint)' }}>{hint}</small>}
    </div>
  );
}

/* El botón se deshabilita solo mientras la acción corre: sin esto, doble clic
   en "Crear cuenta" manda dos altas y dos correos. */
export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="ui-btn ui-btn-primary ui-btn-block" type="submit" disabled={pending}>
      {pending ? 'Un momento…' : children}
    </button>
  );
}

export function Notice({ state }: { state: { error?: string; ok?: string } }) {
  if (state.error) return <div className="ui-alert ui-alert-danger" style={{ marginBottom: 'var(--space-3)' }}>{state.error}</div>;
  if (state.ok) return <div className="ui-alert ui-alert-ok" style={{ marginBottom: 'var(--space-3)' }}>{state.ok}</div>;
  return null;
}
