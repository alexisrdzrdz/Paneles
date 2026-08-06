import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, users } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { statusIsOpen } from '@/lib/bom';
import { STATUS, money, when } from '@/lib/quotes';

/* La cola de trabajo del taller: todo lo que los clientes han enviado, lo
   vivo primero. Cada tarjeta abre el detalle, que es la misma página del
   portal del cliente con el bloque de gestión encima. */
export default async function SolicitudesPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (!isAdmin(user)) redirect('/portal');

  const rows = await db
    .select({
      id: quotes.id, reference: quotes.reference, name: quotes.name,
      status: quotes.status, totalCents: quotes.totalCents, currency: quotes.currency,
      unitCount: quotes.unitCount, updatedAt: quotes.updatedAt,
      clientName: users.name, clientCompany: users.company,
    })
    .from(quotes)
    .leftJoin(users, eq(quotes.userId, users.id))
    .where(ne(quotes.status, 'draft'))
    .orderBy(desc(quotes.updatedAt));

  const vivas = rows.filter((q) => statusIsOpen(q.status));
  const cerradas = rows.filter((q) => !statusIsOpen(q.status));

  const card = (q: (typeof rows)[number]) => {
    const s = STATUS[q.status];
    return (
      <Link key={q.id} className="quote-card" href={`/portal/${q.id}`}>
        <div>
          <span className="ref">{q.reference}</span>
          <b>{q.name}</b>
          <span className={`ui-badge ${s.tone}`}>{s.label}</span>
          <div className="meta" style={{ marginTop: 6 }}>
            {q.clientName ?? 'Cliente eliminado'}{q.clientCompany ? ` · ${q.clientCompany}` : ''}
          </div>
          <div className="meta">
            {q.unitCount} {q.unitCount === 1 ? 'unidad' : 'unidades'} · actualizado {when(q.updatedAt)}
          </div>
        </div>
        <div className="money">{money(q.totalCents, q.currency)}</div>
      </Link>
    );
  };

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Solicitudes</h1>
          <p>{vivas.length === 0
            ? 'Nada pendiente por ahora.'
            : `${vivas.length} ${vivas.length === 1 ? 'proyecto vivo' : 'proyectos vivos'} esperando el siguiente paso.`}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link className="ui-btn" href="/admin">Tabulador</Link>
          <Link className="ui-btn" href="/admin/calculadora">Calculadora</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p><b>Todavía no llega ninguna solicitud.</b></p>
          <p>Cuando un cliente pulse “Solicitar cotización formal” en el cotizador, aparecerá aquí y te llegará un correo.</p>
        </div>
      ) : (
        <>
          <div className="quote-grid">{vivas.map(card)}</div>
          {cerradas.length > 0 && (
            <>
              <h2 style={{ fontSize: 15, color: 'var(--ink-dim)', margin: 'var(--space-5) 0 var(--space-3)' }}>
                Cerradas
              </h2>
              <div className="quote-grid">{cerradas.map(card)}</div>
            </>
          )}
        </>
      )}
    </>
  );
}
