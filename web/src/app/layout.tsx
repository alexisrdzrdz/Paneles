import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser, isAdmin } from '@/lib/auth';
import { logout } from '@/lib/actions/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mauricios Particiones',
  description: 'Particiones sanitarias: cotiza, guarda y da seguimiento a tus proyectos.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es">
      <head>
        {/* Se reutiliza el sistema de diseño que ya existe en el sitio. */}
        <link rel="stylesheet" href="/framework/theme.css" />
        <link rel="stylesheet" href="/framework/framework.css" />
        <link rel="stylesheet" href="/framework/layout.css" />
      </head>
      <body className="ui">
        <header className="app-head">
          <Link href="/" className="app-brand">
            Mauricios <span>Particiones</span>
          </Link>
          <nav className="app-nav">
            {user ? (
              <>
                <Link href="/portal">Mis proyectos</Link>
                {isAdmin(user) && <Link href="/admin">Administración</Link>}
                <span className="app-who">{user.name}</span>
                <form action={logout}>
                  <button className="ui-btn" type="submit">Salir</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/entrar">Entrar</Link>
                <Link href="/registro" className="ui-btn ui-btn-primary">Crear cuenta</Link>
              </>
            )}
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
