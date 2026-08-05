import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser, isAdmin } from '@/lib/auth';
import { Calculadora } from './Calculadora';

export default async function CalculadoraPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (!isAdmin(user)) redirect('/portal');

  return (
    <>
      <p style={{ margin: '0 0 var(--space-3)' }}>
        <Link href="/admin" style={{ color: 'var(--link)' }}>← Tabulador</Link>
      </p>
      <div className="portal-head">
        <div>
          <h1>Calculadora de material</h1>
          <p>
            Captura las medidas de un proyecto y sale el despiece completo con los precios
            del tabulador. Sirve para comprobar lo que capturaste antes de que lo vea un cliente.
          </p>
        </div>
      </div>
      <Calculadora />
    </>
  );
}
