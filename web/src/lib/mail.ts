import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Mail = { to: string; subject: string; html: string; text: string };

const FROM = process.env.MAIL_FROM ?? 'Beta Particiones <no-reply@localhost>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/* Sin API key el correo no se pierde: se escribe en web/.mail/ y el enlace se
   imprime en la consola. Así se prueba registro y verificación en local sin
   dar de alta un proveedor. En hosts sin disco escribible (Vercel y similares)
   el archivo falla pero el enlace SIEMPRE queda en el log: registrarse nunca
   truena por un correo. */
async function deliverToDisk(mail: Mail) {
  const link = /href="([^"]+)"/.exec(mail.html)?.[1];
  console.log(`\n📧  ${mail.subject}  →  ${mail.to}`);
  if (link) console.log(`    Enlace: ${link}\n`);
  try {
    const dir = join(process.cwd(), '.mail');
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `${stamp}-${mail.to.replace(/[^a-z0-9]/gi, '_')}.html`);
    await writeFile(file, mail.html, 'utf8');
    console.log(`    ${file}`);
  } catch {
    /* disco de solo lectura: el log de arriba ya lleva lo importante */
  }
}

async function deliverViaResend(mail: Mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function sendMail(mail: Mail) {
  if (process.env.RESEND_API_KEY) return deliverViaResend(mail);
  return deliverToDisk(mail);
}

const shell = (title: string, body: string) => `
<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#191c22">
  <h1 style="font-size:20px;margin:0 0 4px">Beta <span style="color:#4a7c7b">Particiones</span></h1>
  <p style="color:#6e7888;font-size:13px;margin:0 0 24px">${title}</p>
  ${body}
  <p style="color:#9aa2ad;font-size:12px;margin-top:32px;border-top:1px solid #e6e8ec;padding-top:16px">
    Si no esperabas este correo, puedes ignorarlo sin hacer nada.
  </p>
</div>`;

const button = (href: string, label: string) => `
  <a href="${href}" style="display:inline-block;background:#4a7c7b;color:#fff;text-decoration:none;
     padding:12px 22px;border-radius:8px;font-weight:600">${label}</a>
  <p style="color:#6e7888;font-size:12px;margin-top:18px;word-break:break-all">
    O copia este enlace: ${href}</p>`;

export function verificationMail(to: string, name: string, token: string) {
  const href = `${APP_URL}/verificar?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Confirma tu correo · Beta Particiones',
    html: shell('Confirmación de correo', `
      <p>Hola ${name}, ya casi está. Confirma tu correo para activar tu cuenta
         y poder guardar y dar seguimiento a tus proyectos.</p>
      ${button(href, 'Confirmar mi correo')}
      <p style="color:#6e7888;font-size:12px">El enlace caduca en 24 horas.</p>`),
    text: `Hola ${name}, confirma tu correo: ${href} (caduca en 24 horas)`,
  });
}

/* ── Correos del ciclo de cotización ──────────────────────────────────── */

export function solicitudClienteMail(to: string, name: string, ref: string, quoteUrl: string) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: `Recibimos tu solicitud ${ref} · Beta Particiones`,
    html: shell('Solicitud recibida', `
      <p>Hola ${name}, tu solicitud <b>${ref}</b> ya está con nosotros y entra a
         revisión. Te avisamos por aquí en cada avance, y siempre puedes ver el
         estado en tu portal.</p>
      ${button(href, 'Ver mi proyecto')}`),
    text: `Hola ${name}, recibimos tu solicitud ${ref}. Síguela en ${href}`,
  });
}

export function solicitudAdminMail(
  to: string, adminName: string,
  ref: string, clientName: string, company: string | null, totalTxt: string, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  const quien = company ? `${clientName} (${company})` : clientName;
  return sendMail({
    to,
    subject: `Nueva solicitud ${ref} de ${quien}`,
    html: shell('Nueva solicitud de cotización', `
      <p>Hola ${adminName}: entró la solicitud <b>${ref}</b> de <b>${quien}</b>
         con un estimado del tabulador de <b>${totalTxt}</b>.</p>
      ${button(href, 'Revisar la solicitud')}`),
    text: `Nueva solicitud ${ref} de ${quien} — estimado ${totalTxt}. Revísala en ${href}`,
  });
}

export function estadoMail(
  to: string, name: string,
  ref: string, statusLabel: string, statusHint: string, message: string | null, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: `${ref}: ${statusLabel} · Beta Particiones`,
    html: shell('Avance de tu proyecto', `
      <p>Hola ${name}, tu proyecto <b>${ref}</b> cambió a
         <b>${statusLabel}</b>. ${statusHint}</p>
      ${message ? `<p style="border-left:3px solid #4a7c7b;padding-left:12px;color:#3a4149">${message}</p>` : ''}
      ${button(href, 'Ver el detalle')}`),
    text: `Tu proyecto ${ref} cambió a ${statusLabel}. ${message ?? ''} Detalle: ${href}`,
  });
}

export function decisionAdminMail(
  to: string, adminName: string,
  ref: string, clientName: string, aprobado: boolean, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: aprobado
      ? `✔ ${clientName} aprobó la cotización ${ref}`
      : `${clientName} no continuará con ${ref}`,
    html: shell(aprobado ? 'Cotización aprobada' : 'Proyecto descartado', `
      <p>Hola ${adminName}: <b>${clientName}</b> ${aprobado
        ? `aprobó la cotización <b>${ref}</b>. Sigue pasarla a fabricación.`
        : `decidió no continuar con <b>${ref}</b>.`}</p>
      ${button(href, 'Ver el proyecto')}`),
    text: `${clientName} ${aprobado ? 'aprobó' : 'no continuará con'} ${ref}. Detalle: ${href}`,
  });
}

export function pagoReportadoAdminMail(
  to: string, adminName: string,
  ref: string, clientName: string, montoTxt: string, saldoTxt: string, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: `Pago por validar en ${ref}: ${montoTxt} de ${clientName}`,
    html: shell('Pago reportado', `
      <p>Hola ${adminName}: <b>${clientName}</b> reporta una transferencia de
         <b>${montoTxt}</b> en <b>${ref}</b> y subió su comprobante.
         Saldo confirmado pendiente: <b>${saldoTxt}</b>.</p>
      ${button(href, 'Revisar y validar')}`),
    text: `${clientName} reporta ${montoTxt} en ${ref} (comprobante adjunto en el sistema). Valida en ${href}`,
  });
}

export function pagoValidadoMail(
  to: string, name: string,
  ref: string, montoTxt: string, confirmado: boolean, nota: string | null,
  saldoTxt: string, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: confirmado
      ? `Pago confirmado en ${ref} · Beta Particiones`
      : `Sobre tu pago en ${ref} · Beta Particiones`,
    html: shell(confirmado ? 'Pago confirmado' : 'Pago por aclarar', `
      <p>Hola ${name}, ${confirmado
        ? `confirmamos tu pago de <b>${montoTxt}</b> en <b>${ref}</b>. Saldo pendiente: <b>${saldoTxt}</b>.`
        : `no pudimos validar tu pago de <b>${montoTxt}</b> en <b>${ref}</b>.`}</p>
      ${!confirmado && nota ? `<p style="border-left:3px solid #a33;padding-left:12px;color:#3a4149">${nota}</p>` : ''}
      ${button(href, 'Ver mi proyecto')}`),
    text: confirmado
      ? `Confirmamos tu pago de ${montoTxt} en ${ref}. Saldo: ${saldoTxt}. ${href}`
      : `No pudimos validar tu pago de ${montoTxt} en ${ref}. ${nota ?? ''} ${href}`,
  });
}

export function pagoClienteMail(
  to: string, name: string,
  ref: string, montoTxt: string, saldoTxt: string, quoteUrl: string,
) {
  const href = `${APP_URL}${quoteUrl}`;
  return sendMail({
    to,
    subject: `Pago recibido en ${ref} · Beta Particiones`,
    html: shell('Pago registrado', `
      <p>Hola ${name}, registramos un pago de <b>${montoTxt}</b> en tu proyecto
         <b>${ref}</b>. Saldo pendiente: <b>${saldoTxt}</b>.</p>
      ${button(href, 'Ver mis pagos')}`),
    text: `Hola ${name}, registramos un pago de ${montoTxt} en ${ref}. Saldo: ${saldoTxt}. Detalle: ${href}`,
  });
}

export function passwordResetMail(to: string, name: string, token: string) {
  const href = `${APP_URL}/restablecer?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Restablece tu contraseña · Beta Particiones',
    html: shell('Recuperación de contraseña', `
      <p>Hola ${name}, recibimos una solicitud para cambiar tu contraseña.</p>
      ${button(href, 'Elegir contraseña nueva')}
      <p style="color:#6e7888;font-size:12px">El enlace caduca en 1 hora.
         Si no fuiste tú, tu contraseña actual sigue funcionando.</p>`),
    text: `Hola ${name}, restablece tu contraseña: ${href} (caduca en 1 hora)`,
  });
}
