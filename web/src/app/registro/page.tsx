import { RegistroForm } from './RegistroForm';

/* Igual que /entrar: `?next=` viaja por los enlaces para que quien venía del
   cotizador termine de vuelta en el cotizador. */
export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegistroForm next={typeof next === 'string' && next.startsWith('/') ? next : undefined} />;
}
