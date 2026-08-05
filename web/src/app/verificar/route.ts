import { NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/actions/auth';

/* La confirmación es un Route Handler, no una página: al validar el token se
   abre la sesión, y Next solo permite escribir cookies fuera del render. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const ok = token ? await verifyEmail(token) : false;
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  return NextResponse.redirect(new URL(ok ? '/portal?bienvenida=1' : '/verificar/caducado', base));
}
