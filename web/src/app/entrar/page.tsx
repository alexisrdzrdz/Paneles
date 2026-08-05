'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type FormState } from '@/lib/actions/auth';
import { Field, Submit, Notice } from '@/components/Field';

export default function EntrarPage() {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <div className="auth-card">
      <h1>Entrar</h1>
      <p className="lead">Accede a tus proyectos y a su seguimiento.</p>
      <Notice state={state} />
      <form action={action}>
        <Field label="Correo" name="email" type="email" required autoComplete="email" />
        <Field label="Contraseña" name="password" type="password" required autoComplete="current-password" />
        <Submit>Entrar</Submit>
      </form>
      <p className="auth-foot">
        <Link href="/recuperar">Olvidé mi contraseña</Link> · ¿Sin cuenta? <Link href="/registro">Crea una</Link>.
      </p>
    </div>
  );
}
