'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resendVerification, type FormState } from '@/lib/actions/auth';
import { Field, Submit, Notice } from '@/components/Field';

export default function ReenviarPage() {
  const [state, action] = useActionState<FormState, FormData>(resendVerification, {});
  return (
    <div className="auth-card">
      <h1>Reenviar confirmación</h1>
      <p className="lead">Si el enlace caducó, te mandamos otro.</p>
      <Notice state={state} />
      {!state.ok && (
        <form action={action}>
          <Field label="Correo" name="email" type="email" required autoComplete="email" />
          <Submit>Enviar de nuevo</Submit>
        </form>
      )}
      <p className="auth-foot"><Link href="/entrar">Volver a entrar</Link></p>
    </div>
  );
}
