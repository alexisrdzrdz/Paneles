'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestReset, type FormState } from '@/lib/actions/auth';
import { Field, Submit, Notice } from '@/components/Field';

export default function RecuperarPage() {
  const [state, action] = useActionState<FormState, FormData>(requestReset, {});
  return (
    <div className="auth-card">
      <h1>Recuperar contraseña</h1>
      <p className="lead">Te mandamos un enlace para elegir una nueva.</p>
      <Notice state={state} />
      {!state.ok && (
        <form action={action}>
          <Field label="Correo" name="email" type="email" required autoComplete="email" />
          <Submit>Enviar enlace</Submit>
        </form>
      )}
      <p className="auth-foot"><Link href="/entrar">Volver a entrar</Link></p>
    </div>
  );
}
