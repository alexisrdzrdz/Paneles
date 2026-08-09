import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments, paymentReceipts, quotes } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { isUuid } from '@/lib/quotes';

/* Sirve el comprobante de un pago. Solo el dueño del proyecto o el staff:
   un comprobante trae cuentas y nombres, no es un archivo público. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });

  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const pago = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!pago) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, pago.quoteId) });
  if (!quote || (quote.userId !== user.id && !isAdmin(user))) {
    return NextResponse.json({ error: 'No existe' }, { status: 404 });
  }

  const recibo = await db.query.paymentReceipts.findFirst({
    where: eq(paymentReceipts.paymentId, id),
  });
  if (!recibo) return NextResponse.json({ error: 'Este pago no tiene comprobante' }, { status: 404 });

  return new NextResponse(new Uint8Array(recibo.data), {
    headers: {
      'Content-Type': recibo.mime,
      'Content-Disposition': `inline; filename="${recibo.filename.replace(/[^\w. -]/g, '_')}"`,
      'Cache-Control': 'private, max-age=0',
      /* El navegador respeta el MIME declarado y no re-olfatea el contenido;
         el comprobante se aísla por si el archivo trae algo inesperado. */
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox; img-src 'self'; object-src 'self'",
    },
  });
}
