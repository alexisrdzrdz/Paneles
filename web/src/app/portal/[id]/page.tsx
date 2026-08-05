import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, quoteEvents, users } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { STATUS, FLOW, money, when } from '@/lib/quotes';

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  const { id } = await params;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  /* Un cliente solo ve lo suyo. El staff ve todo; por eso la comprobación es
     de pertenencia O de rol, y va antes de cargar nada más. */
  if (!quote || (quote.userId !== user.id && !isAdmin(user))) notFound();

  const events = await db
    .select({
      id: quoteEvents.id, type: quoteEvents.type, message: quoteEvents.message,
      toStatus: quoteEvents.toStatus, createdAt: quoteEvents.createdAt,
      actorName: users.name,
    })
    .from(quoteEvents)
    .leftJoin(users, eq(quoteEvents.actorId, users.id))
    .where(isAdmin(user)
      ? eq(quoteEvents.quoteId, id)
      : and(eq(quoteEvents.quoteId, id), eq(quoteEvents.visibleToCustomer, true)))
    .orderBy(asc(quoteEvents.createdAt));

  const s = STATUS[quote.status];
  const step = FLOW.indexOf(quote.status);

  return (
    <>
      <p style={{ margin: '0 0 var(--space-3)' }}>
        <Link href="/portal" style={{ color: 'var(--link)' }}>← Mis proyectos</Link>
      </p>

      <div className="portal-head">
        <div>
          <span className="ref" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>
            {quote.reference}
          </span>
          <h1>{quote.name}</h1>
          <p>{s.hint}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`ui-badge ${s.tone}`}>{s.label}</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, marginTop: 6 }}>
            {money(quote.totalCents, quote.currency)}
          </div>
        </div>
      </div>

      <div className="two-col">
        <section>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Seguimiento</h2>
          {events.length === 0 ? (
            <p style={{ color: 'var(--ink-dim)' }}>Aún no hay movimientos registrados.</p>
          ) : (
            <ul className="track">
              {events.map((e, i) => (
                <li key={e.id} className={i === events.length - 1 ? 'is-current' : ''}>
                  <span className="dot" />
                  <span className="when">{when(e.createdAt)}</span>
                  <span className="what">
                    {e.toStatus ? <b>{STATUS[e.toStatus].label}</b> : null}
                    {e.toStatus && e.message ? ' — ' : null}
                    {e.message}
                  </span>
                  {e.actorName && <span className="who">por {e.actorName}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <div style={{
            border: 'var(--border-width) solid var(--line)', borderRadius: 'var(--radius-md)',
            background: 'var(--surface)', padding: 'var(--space-4)',
          }}>
            <h2 style={{ fontSize: 14, marginTop: 0, color: 'var(--ink-dim)' }}>Avance</h2>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 'var(--fs-label)' }}>
              {FLOW.map((st, i) => (
                <li key={st} style={{
                  padding: '5px 0',
                  color: step < 0 ? 'var(--ink-faint)'
                       : i < step ? 'var(--ink-dim)'
                       : i === step ? 'var(--ink)' : 'var(--ink-faint)',
                  fontWeight: i === step ? 600 : 400,
                }}>
                  {i < step ? '✓ ' : i === step ? '● ' : '○ '}{STATUS[st].label}
                </li>
              ))}
            </ol>
            <hr style={{ border: 0, borderTop: 'var(--border-width) solid var(--line)', margin: 'var(--space-3) 0' }} />
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--ink-dim)', lineHeight: 1.8 }}>
              <div>Unidades: <b>{quote.unitCount}</b></div>
              <div>Material: <b>{quote.materialId ?? '—'}</b></div>
              <div>Creado: {when(quote.createdAt)}</div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
