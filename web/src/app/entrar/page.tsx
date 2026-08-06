import { EntrarForm } from './EntrarForm';

/* La página lee `?next=` en el servidor y el formulario lo lleva de vuelta a
   la acción de login: quien venía del cotizador regresa al cotizador. */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <EntrarForm next={typeof next === 'string' && next.startsWith('/') ? next : undefined} />;
}
