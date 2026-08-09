import 'server-only';

/* Defensa CSRF para los route handlers que mutan con la sesión de la cookie.
   Los Server Actions de Next ya validan el origen solos; estos handlers no,
   así que se comprueba a mano: un formulario en otro dominio que intente
   disparar la petición llevará un Origin ajeno y se rechaza. La ausencia de
   Origin se permite (curl, apps nativas) — el ataque CSRF siempre lo trae,
   porque lo pone el navegador. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
