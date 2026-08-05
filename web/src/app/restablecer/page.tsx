'use client';

import Link from 'next/link';
import { use } from 'react';
import { useActionState } from 'react';
import { resetPassword, type FormState } from '@/lib/actions/auth';
import { Field, Submit, Notice } from '@/components/Field';

export default function RestablecerPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = use(searchParams);
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});

  if (!token) {
    return (
      <div className="auth-card">
        <h1>Enlace incompleto</h1>
        <p className="lead">Abre el enlace tal cual llegó a tu correo.</p>
        <Link className="ui-btn ui-btn-primary ui-btn-block" href="/recuperar">Pedir uno nuevo</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Nueva contraseña</h1>
      <p className="lead">Elige una contraseña y entra directo.</p>
      <Notice state={state} />
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <Field label="Contraseña nueva" name="password" type="password" required
               autoComplete="new-password" hint="Mínimo 8 caracteres." />
        <Field label="Repítela" name="confirm" type="password" required autoComplete="new-password" />
        <Submit>Guardar y entrar</Submit>
      </form>
    </div>
  );
}
