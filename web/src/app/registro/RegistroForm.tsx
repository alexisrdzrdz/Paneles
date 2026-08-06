'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { register, type FormState } from '@/lib/actions/auth';
import { Field, Submit, Notice } from '@/components/Field';

export function RegistroForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(register, {});
  const entrar = next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar';

  return (
    <div className="auth-card">
      <h1>Crear cuenta</h1>
      <p className="lead">Guarda tus cotizaciones y sigue cada proyecto de principio a fin.</p>

      <Notice state={state} />

      {state.ok ? (
        <p className="auth-foot">
          ¿No te llegó? <Link href="/reenviar">Pide otro enlace</Link>.
        </p>
      ) : (
        <form action={action}>
          <Field label="Nombre" name="name" required autoComplete="name" />
          <Field label="Correo" name="email" type="email" required autoComplete="email" />
          <Field label="Empresa (opcional)" name="company" autoComplete="organization" />
          <Field label="Teléfono (opcional)" name="phone" type="tel" autoComplete="tel" />
          <Field label="Contraseña" name="password" type="password" required
                 autoComplete="new-password" hint="Mínimo 8 caracteres." />
          <Field label="Repite la contraseña" name="confirm" type="password" required
                 autoComplete="new-password" />
          <Submit>Crear cuenta</Submit>
        </form>
      )}

      <p className="auth-foot">¿Ya tienes cuenta? <Link href={entrar}>Entra aquí</Link>.</p>
    </div>
  );
}
