import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, type Quote, type QuoteStatus } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { STATUS, money, when } from '@/lib/quotes';

/* El portal separa lo que el cliente tiene en la cabeza: pedidos andando
   (dinero comprometido), cotizaciones en curso y lo ya terminado. */
const GRUPOS: { titulo: string; hint: string; estados: QuoteStatus[] }[] = [
  { titulo: 'Pedidos en curso', hint: 'Aprobados y en camino.',
    estados: ['approved', 'in_production', 'shipped'] },
  { titulo: 'Cotizaciones', hint: 'Todavía sin aprobar.',
    estados: ['draft', 'submitted', 'reviewing', 'quoted'] },
  { titulo: 'Terminados', hint: 'Entregados o cancelados.',
    estados: ['delivered', 'cancelled'] },
];

function Card({ q }: { q: Quote }) {
  const s = STATUS[q.status];
  return (
    <Link className="quote-card" href={`/portal/${q.id}`}>
      <div>
        <span className="ref">{q.reference}</span>
        <b>{q.name}</b>
        <span className={`ui-badge ${s.tone}`}>{s.label}</span>
        <div className="meta" style={{ marginTop: 6 }}>
          {q.unitCount} {q.unitCount === 1 ? 'unidad' : 'unidades'} · actualizado {when(q.updatedAt)}
        </div>
      </div>
      <div className="money">{money(q.totalCents, q.currency)}</div>
    </Link>
  );
}

export default async function PortalPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');

  const rows = await db.query.quotes.findMany({
    where: eq(quotes.userId, user.id),
    orderBy: [desc(quotes.updatedAt)],
  });

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Mis proyectos</h1>
          <p>Hola {user.name.split(' ')[0]}. Aquí vive el historial de todo lo que has cotizado.</p>
        </div>
        <a className="ui-btn ui-btn-primary" href="/cotizador.html">Nueva cotización</a>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p><b>Todavía no tienes proyectos.</b></p>
          <p>Cuando cotices un baño y lo envíes, aparecerá aquí con su folio y seguimiento.</p>
          <a className="ui-btn ui-btn-primary" href="/cotizador.html">Cotizar mi primer baño</a>
        </div>
      ) : (
        GRUPOS.map(({ titulo, hint, estados }) => {
          const grupo = rows.filter((q) => estados.includes(q.status));
          if (!grupo.length) return null;
          return (
            <section key={titulo} style={{ marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 15, margin: '0 0 var(--space-3)' }}>
                {titulo} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>— {hint}</span>
              </h2>
              <div className="quote-grid">
                {grupo.map((q) => <Card key={q.id} q={q} />)}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
