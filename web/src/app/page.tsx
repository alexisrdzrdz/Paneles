import Link from 'next/link';
import { currentUser } from '@/lib/auth';

export default async function Home() {
  const user = await currentUser();
  return (
    <div style={{ maxWidth: 680, margin: 'var(--space-6) auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 34, margin: '0 0 8px' }}>Particiones sanitarias a tu medida</h1>
      <p style={{ color: 'var(--ink-dim)', fontSize: 17, margin: '0 0 var(--space-5)' }}>
        Cotiza tu baño en minutos, guárdalo en tu cuenta y sigue el proyecto
        hasta que llega a obra.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a className="ui-btn ui-btn-primary" href="/cotizador.html">Cotizar ahora</a>
        <Link className="ui-btn" href={user ? '/portal' : '/registro'}>
          {user ? 'Mis proyectos' : 'Crear cuenta'}
        </Link>
      </div>
    </div>
  );
}
