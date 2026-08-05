import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { quotes } from '@/db/schema';
import { currentUser } from '@/lib/auth';
import { STATUS, money, when } from '@/lib/quotes';

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
          <p>Cuando cotices un baño y lo guardes, aparecerá aquí con su seguimiento.</p>
          <a className="ui-btn ui-btn-primary" href="/cotizador.html">Cotizar mi primer baño</a>
        </div>
      ) : (
        <div className="quote-grid">
          {rows.map((q) => {
            const s = STATUS[q.status];
            return (
              <Link key={q.id} className="quote-card" href={`/portal/${q.id}`}>
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
          })}
        </div>
      )}
    </>
  );
}
