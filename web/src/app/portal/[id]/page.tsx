import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, quoteEvents, quoteLines, users, payments, paymentReceipts } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { currentUser, isAdmin } from '@/lib/auth';
import { STATUS, FLOW, money, when } from '@/lib/quotes';
import { MATERIAL_NOMBRE } from '@/lib/materiales';
import type { Direccion as Dir } from '@/lib/actions/quotes';
import { Gestion } from './Gestion';
import { Decision } from './Decision';
import { AbrirEnCotizador } from './AbrirEnCotizador';
import { Direccion } from './Direccion';
import { PagoForm } from './PagoForm';
import { ReportarPago } from './ReportarPago';
import { PagoValidar } from './PagoValidar';
import { Conversacion } from './Conversacion';

const METODO: Record<string, string> = {
  transferencia: 'Transferencia', deposito: 'Depósito',
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro',
};

const PAGO_BADGE: Record<string, { label: string; tone: string }> = {
  pendiente:  { label: 'Por validar', tone: 'ui-badge-info' },
  confirmado: { label: 'Confirmado',  tone: 'ui-badge-ok' },
  rechazado:  { label: 'No validado', tone: 'ui-badge-danger' },
};

/* Estados en los que el cliente ya puede transferir y reportar su pago. */
const PAGABLES = new Set(['approved', 'in_production', 'shipped', 'delivered']);

/* Cantidades en milésimas → texto: 2000 = "2", 6250 = "6.25". */
const qty = (milli: number) =>
  (milli / 1000).toFixed(2).replace(/\.?0+$/, '');

/* Hacia dónde abre la puerta, en palabras que el taller usa. */
const SWING: Record<string, string> = {
  'left-in': 'bisagra izq. · abre adentro',
  'left-out': 'bisagra izq. · abre afuera',
  'right-in': 'bisagra der. · abre adentro',
  'right-out': 'bisagra der. · abre afuera',
};

type ProyectoGuardado = { runs?: { units?: { kind: string; doorSwing?: string | null }[] }[] };

/* Lee del proyecto guardado el giro de cada puerta de cabina. */
function puertasDe(payload: unknown): string[] {
  const proyecto = (payload as { proyecto?: ProyectoGuardado } | null)?.proyecto;
  const out: string[] = [];
  proyecto?.runs?.forEach((r) => r.units?.forEach((u) => {
    if (u.kind === 'stall') out.push(SWING[u.doorSwing ?? ''] ?? 'sin especificar');
  }));
  return out;
}

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  const { id } = await params;

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, id) });
  /* Un cliente solo ve lo suyo. El staff ve todo; por eso la comprobación es
     de pertenencia O de rol, y va antes de cargar nada más. */
  if (!quote || (quote.userId !== user.id && !isAdmin(user))) notFound();

  const admin = isAdmin(user);
  const owner = admin && quote.userId !== user.id
    ? await db.query.users.findFirst({ where: eq(users.id, quote.userId) })
    : null;

  /* El despiece solo se enseña al staff: al cliente ni se le consulta. */
  const lines = admin
    ? await db.query.quoteLines.findMany({
        where: eq(quoteLines.quoteId, id), orderBy: [asc(quoteLines.sortOrder)],
      })
    : [];
  const sumaDespiece = lines.reduce((s, l) => s + l.totalCents, 0);

  const pagos = await db.query.payments.findMany({
    where: eq(payments.quoteId, id), orderBy: [asc(payments.paidAt)],
  });
  /* Solo lo confirmado abona; lo pendiente se enseña aparte, sin sumar. */
  const pagado = pagos.filter((p) => p.status === 'confirmado').reduce((s, p) => s + p.amountCents, 0);
  const porValidar = pagos.filter((p) => p.status === 'pendiente').reduce((s, p) => s + p.amountCents, 0);
  const saldo = Math.max(0, quote.totalCents - pagado);

  /* Qué pagos traen comprobante (solo los ids: el archivo pesa y se sirve
     por su propia ruta con permisos). */
  const conRecibo = new Set(
    pagos.length
      ? (await db.select({ paymentId: paymentReceipts.paymentId }).from(paymentReceipts)
          .where(inArray(paymentReceipts.paymentId, pagos.map((p) => p.id))))
          .map((r) => r.paymentId)
      : [],
  );

  const esDueno = quote.userId === user.id;
  const puedePagar = esDueno && PAGABLES.has(quote.status);
  const instruccionesPago = process.env.PAGO_INSTRUCCIONES
    ?? 'Transferencia o depósito directo a nuestra cuenta. Si aún no tienes los datos, pídelos por WhatsApp o correo y con gusto te los compartimos.';

  const events = await db
    .select({
      id: quoteEvents.id, type: quoteEvents.type, message: quoteEvents.message,
      toStatus: quoteEvents.toStatus, createdAt: quoteEvents.createdAt,
      actorName: users.name, actorId: quoteEvents.actorId, actorRole: users.role,
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
        {admin
          ? <Link href="/admin/solicitudes" style={{ color: 'var(--link)' }}>← Solicitudes</Link>
          : <Link href="/portal" style={{ color: 'var(--link)' }}>← Mis proyectos</Link>}
      </p>

      <div className="portal-head">
        <div>
          <span className="ref" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>
            {quote.reference}
          </span>
          <h1>{quote.name}</h1>
          <p>{owner ? <>De <b>{owner.name}</b>{owner.company ? ` · ${owner.company}` : ''} — </> : null}{s.hint}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`ui-badge ${s.tone}`}>{s.label}</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, marginTop: 6 }}>
            {money(quote.totalCents, quote.currency)}
          </div>
        </div>
      </div>

      {admin && <Gestion quoteId={quote.id} estado={quote.status} />}
      {quote.userId === user.id && quote.status === 'quoted' && (
        <Decision quoteId={quote.id} totalTxt={money(quote.totalCents, quote.currency)} />
      )}

      <div className="two-col">
        <section>
          {/* El despiece con precios unitarios es información del taller:
              el cliente ve su total y su seguimiento, no la ingeniería. */}
          {admin && lines.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Desglose <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: 12 }}>solo staff</span></h2>
              <div className="desglose-wrap">
                <table className="desglose">
                  <thead>
                    <tr><th>Pieza</th><th>Cantidad</th><th>P. unitario</th><th>Importe</th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.name}
                          {l.billedMilli > l.neededMilli && (
                            <small> — usas {qty(l.neededMilli)} {l.unit}; se surte en piezas completas</small>
                          )}
                        </td>
                        <td className="num">{qty(l.billedMilli)} {l.unit}</td>
                        <td className="num">{money(l.unitPriceCents, quote.currency)}</td>
                        <td className="num">{money(l.totalCents, quote.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Suma del despiece (con flete)</td>
                      <td className="num">{money(sumaDespiece, quote.currency)}</td>
                    </tr>
                    {sumaDespiece !== quote.totalCents && (
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 400, color: 'var(--ink-dim)' }}>
                          Lo que el cliente vio (sin flete)
                        </td>
                        <td className="num" style={{ fontWeight: 400 }}>{money(quote.totalCents, quote.currency)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {(pagos.length > 0 || admin || puedePagar) && (
            <>
              <h2 style={{ fontSize: 16, marginTop: admin && lines.length ? 'var(--space-5)' : 0 }}>Pagos</h2>
              {pagos.length === 0 ? (
                <p style={{ color: 'var(--ink-dim)' }}>
                  {puedePagar
                    ? 'Aún no registras ningún pago. Cuando transfieras, sube aquí tu comprobante.'
                    : 'Sin pagos registrados.'}
                </p>
              ) : (
                <div className="desglose-wrap">
                  <table className="desglose">
                    <thead>
                      <tr><th>Fecha</th><th>Método</th><th>Estado</th><th>Monto</th></tr>
                    </thead>
                    <tbody>
                      {pagos.map((p) => {
                        const b = PAGO_BADGE[p.status];
                        return (
                          <tr key={p.id}>
                            <td>
                              {when(p.paidAt)}
                              {(p.reference || p.note) && <small>{[p.reference, p.note].filter(Boolean).join(' · ')}</small>}
                            </td>
                            <td>
                              {METODO[p.method]}
                              {conRecibo.has(p.id) && (
                                <small><a href={`/api/comprobantes/${p.id}`} target="_blank" style={{ color: 'var(--link)' }}>
                                  ver comprobante
                                </a></small>
                              )}
                            </td>
                            <td>
                              <span className={`ui-badge ${b.tone}`}>{b.label}</span>
                              {admin && p.status === 'pendiente' && (
                                <div style={{ marginTop: 4 }}><PagoValidar paymentId={p.id} /></div>
                              )}
                            </td>
                            <td className="num">{money(p.amountCents, quote.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>
                          Pagado {money(pagado, quote.currency)}
                          {porValidar > 0 && <> · por validar {money(porValidar, quote.currency)}</>}
                          {' '}· Saldo
                        </td>
                        <td className="num">{money(saldo, quote.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {puedePagar && <ReportarPago quoteId={quote.id} instrucciones={instruccionesPago} />}
              {admin && <PagoForm quoteId={quote.id} />}
            </>
          )}

          <h2 style={{ fontSize: 16, marginTop: admin || pagos.length || puedePagar ? 'var(--space-5)' : 0 }}>
            Conversación y seguimiento
          </h2>
          <p className="ui-meta" style={{ marginTop: 0 }}>
            {admin
              ? 'Escríbele al cliente aquí; le llega en su portal, sin salir del sistema.'
              : 'Escríbenos aquí cualquier duda o cambio; te respondemos en este mismo espacio.'}
          </p>

          {(esDueno || admin) && <Conversacion quoteId={quote.id} esStaff={admin} />}

          {events.length === 0 ? (
            <p style={{ color: 'var(--ink-dim)', marginTop: 'var(--space-3)' }}>Aún no hay mensajes ni movimientos.</p>
          ) : (
            <ul className="track" style={{ marginTop: 'var(--space-4)' }}>
              {events.map((e, i) => {
                /* Un mensaje del staff (o del sistema) se alinea distinto que
                   el del cliente, para que se lea como conversación. */
                const delStaff = e.actorRole === 'admin' || e.actorRole === 'staff' || !e.actorId;
                const esMio = e.actorId === user.id;
                return (
                  <li key={e.id} className={`conv-line ${delStaff ? 'de-staff' : 'de-cliente'} ${i === events.length - 1 ? 'is-current' : ''}`}>
                    <span className="dot" />
                    <span className="when">{when(e.createdAt)}</span>
                    <span className="what">
                      {e.toStatus ? <b>{STATUS[e.toStatus].label}</b> : null}
                      {e.toStatus && e.message ? ' — ' : null}
                      {e.message}
                    </span>
                    <span className="who">
                      {esMio ? 'tú' : e.actorName ? (delStaff ? `${e.actorName} · equipo` : e.actorName) : 'sistema'}
                    </span>
                  </li>
                );
              })}
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
              <div>Material: <b>{quote.materialId ? (MATERIAL_NOMBRE[quote.materialId] ?? quote.materialId) : '—'}</b></div>
              <div>Creado: {when(quote.createdAt)}</div>
            </div>
            {(() => {
              const estado = (quote.payload as { estado?: unknown } | null)?.estado;
              return estado ? <AbrirEnCotizador estado={estado} /> : null;
            })()}
          </div>

          {(() => {
            const puertas = puertasDe(quote.payload);
            if (!puertas.length) return null;
            const todasIgual = puertas.every((p) => p === puertas[0]);
            return (
              <div style={{
                border: 'var(--border-width) solid var(--line)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', padding: 'var(--space-4)', marginTop: 'var(--space-3)',
              }}>
                <h2 style={{ fontSize: 14, marginTop: 0, color: 'var(--ink-dim)' }}>Apertura de puertas</h2>
                {todasIgual ? (
                  <div style={{ fontSize: 'var(--fs-label)' }}>
                    Las {puertas.length} puertas: <b>{puertas[0]}</b>
                  </div>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 'var(--fs-label)', lineHeight: 1.9 }}>
                    {puertas.map((p, i) => (
                      <li key={i}>Cabina {i + 1}: <b>{p}</b></li>
                    ))}
                  </ol>
                )}
                <p className="ui-meta" style={{ margin: 'var(--space-2) 0 0' }}>Visto de frente a la cabina.</p>
              </div>
            );
          })()}

          <Direccion
            quoteId={quote.id}
            actual={(quote.shipping as Dir | null) ?? null}
            editable={(quote.userId === user.id || admin)
              && !['shipped', 'delivered', 'cancelled'].includes(quote.status)}
          />
        </aside>
      </div>
    </>
  );
}
