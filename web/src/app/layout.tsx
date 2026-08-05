import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser, isAdmin } from '@/lib/auth';
import { logout } from '@/lib/actions/auth';
import { Marca } from '@/components/Marca';
import { MenuMovil } from '@/components/MenuMovil';
import './globals.css';

export const metadata: Metadata = {
  title: 'mauricios · Particiones de baño con cotización en línea',
  description: 'Particiones de baño a medida, con diseño y cotización en línea.',
};

/* Un solo sitio: el mismo encabezado y el mismo pie en las páginas públicas,
   en el portal del cliente y en el panel. Lo que cambia al iniciar sesión es
   el bloque de cuenta, no la identidad del sitio. */
/* Un solo menú declarado en un solo lugar: la barra ancha y el colapsado en
   teléfono se alimentan de aquí, así nunca se desincronizan. */
const NAV = [
  { href: '/cotizador.html', label: 'Cotizador' },
  { href: '/materiales', label: 'Materiales' },
  { href: '/industrias', label: 'Industrias' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/contacto', label: 'Contacto' },
];
const CUENTA_FUERA = [
  { href: '/entrar', label: 'Entrar' },
  { href: '/registro', label: 'Crear cuenta' },
];
const CUENTA_DENTRO = [{ href: '/portal', label: 'Mis proyectos' }];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
        <link rel="stylesheet" href="/framework/theme.css" />
        <link rel="stylesheet" href="/framework/framework.css" />
        <link rel="stylesheet" href="/framework/layout.css" />
        <link rel="stylesheet" href="/framework/movimiento.css" />
        <link rel="stylesheet" href="/site.css" />
        <script src="/framework/ui.js" defer />
      </head>
      <body className="ui" data-layout="topbar" data-panel="card" style={{ margin: 0 }}>
        <header className="ui-topbar site-topbar">
          <Link className="brand" href="/"><Marca /> mauricios <span className="ui-sigla">PARTICIONES</span></Link>
          <div className="ui-topbar-right">
            <nav className="site-nav" aria-label="Navegación">
              {NAV.map((i) => (i.href.endsWith('.html')
                ? <a key={i.href} className="ui-link" href={i.href}>{i.label}</a>
                : <Link key={i.href} className="ui-link" href={i.href}>{i.label}</Link>))}
            </nav>
            <button className="ui-theme-toggle" type="button" aria-label="Cambiar tema" data-ui-theme>{"◐"}</button>
            {user ? (
              <div className="cuenta">
                <Link className="ui-link" href="/portal">Mis proyectos</Link>
                {isAdmin(user) && <Link className="ui-link" href="/admin">Panel</Link>}
                <form action={logout} style={{ display: 'inline' }}>
                  <button className="ui-btn" type="submit">Salir</button>
                </form>
              </div>
            ) : (
              <div className="cuenta">
                <Link className="ui-link" href="/entrar">Entrar</Link>
                <Link className="ui-btn ui-btn-primary" href="/registro">Crear cuenta</Link>
              </div>
            )}
            <MenuMovil items={NAV.concat(user ? CUENTA_DENTRO : CUENTA_FUERA)} />
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="footer-grid section">
            <div>
              <div className="brand" style={{ marginBottom: 'var(--space-2)' }}><Marca size={22} /> mauricios</div>
              <p className="ui-meta">Particiones de baño a medida, con diseño y cotización en línea.</p>
            </div>
            <div><b>Producto</b>
              <a href="/cotizador.html">Cotizador</a>
              <Link href="/materiales">Materiales</Link>
              <Link href="/proyectos">Proyectos</Link>
            </div>
            <div><b>Tu cuenta</b>
              {user ? <Link href="/portal">Mis proyectos</Link> : <Link href="/registro">Crear cuenta</Link>}
              {user ? <Link href="/portal">Historial y seguimiento</Link> : <Link href="/entrar">Entrar</Link>}
              <Link href="/contacto">Contacto</Link>
            </div>
            <div><b>Contacto</b>
              <a href="tel:+525555555555">+52 55 5555 5555</a>
              <a href="https://wa.me/525555555555">WhatsApp</a>
              <a href="mailto:hola@mauricios.mx">hola@mauricios.mx</a>
            </div>
          </div>
          <div className="footer-bottom">© 2026 mauricios · Particiones. Diseñado con el sistema Nord.</div>
        </footer>
      </body>
    </html>
  );
}
