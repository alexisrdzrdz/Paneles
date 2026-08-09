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

/* Nombre, empresa, mensaje… los teclea gente de fuera: escapar antes de
   meterlos en el HTML del correo, o un nombre con etiquetas inyecta markup en
   la bandeja del staff. En el asunto, además, se aplastan los saltos de línea
   para que nadie inyecte cabeceras. */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const escSubj = (s: string | null | undefined) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

export function verificationMail(to: string, name: string, token: string) {
  const href = `${APP_URL}/verificar?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Confirma tu correo · Beta Particiones',
    html: shell('Confirmación de correo', `
      <p>Hola ${esc(name)}, ya casi está. Confirma tu correo para activar tu cuenta
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
      <p>Hola ${esc(name)}, tu solicitud <b>${esc(ref)}</b> ya está con nosotros y entra a
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
    subject: escSubj(`Nueva solicitud ${ref} de ${quien}`),
    html: shell('Nueva solicitud de cotización', `
      <p>Hola ${esc(adminName)}: entró la solicitud <b>${esc(ref)}</b> de <b>${esc(quien)}</b>
         con un estimado del tabulador de <b>${esc(totalTxt)}</b>.</p>
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
      <p>Hola ${esc(name)}, tu proyecto <b>${esc(ref)}</b> cambió a
         <b>${esc(statusLabel)}</b>. ${esc(statusHint)}</p>
      ${message ? `<p style="border-left:3px solid #4a7c7b;padding-left:12px;color:#3a4149">${esc(message)}</p>` : ''}
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
    subject: escSubj(aprobado
      ? `✔ ${clientName} aprobó la cotización ${ref}`
      : `${clientName} no continuará con ${ref}`),
    html: shell(aprobado ? 'Cotización aprobada' : 'Proyecto descartado', `
      <p>Hola ${esc(adminName)}: <b>${esc(clientName)}</b> ${aprobado
        ? `aprobó la cotización <b>${esc(ref)}</b>. Sigue pasarla a fabricación.`
        : `decidió no continuar con <b>${esc(ref)}</b>.`}</p>
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
    subject: escSubj(`Pago por validar en ${ref}: ${montoTxt} de ${clientName}`),
    html: shell('Pago reportado', `
      <p>Hola ${esc(adminName)}: <b>${esc(clientName)}</b> reporta una transferencia de
         <b>${esc(montoTxt)}</b> en <b>${esc(ref)}</b> y subió su comprobante.
         Saldo confirmado pendiente: <b>${esc(saldoTxt)}</b>.</p>
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
      <p>Hola ${esc(name)}, ${confirmado
        ? `confirmamos tu pago de <b>${esc(montoTxt)}</b> en <b>${esc(ref)}</b>. Saldo pendiente: <b>${esc(saldoTxt)}</b>.`
        : `no pudimos validar tu pago de <b>${esc(montoTxt)}</b> en <b>${esc(ref)}</b>.`}</p>
      ${!confirmado && nota ? `<p style="border-left:3px solid #a33;padding-left:12px;color:#3a4149">${esc(nota)}</p>` : ''}
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
      <p>Hola ${esc(name)}, registramos un pago de <b>${esc(montoTxt)}</b> en tu proyecto
         <b>${esc(ref)}</b>. Saldo pendiente: <b>${esc(saldoTxt)}</b>.</p>
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
      <p>Hola ${esc(name)}, recibimos una solicitud para cambiar tu contraseña.</p>
      ${button(href, 'Elegir contraseña nueva')}
      <p style="color:#6e7888;font-size:12px">El enlace caduca en 1 hora.
         Si no fuiste tú, tu contraseña actual sigue funcionando.</p>`),
    text: `Hola ${name}, restablece tu contraseña: ${href} (caduca en 1 hora)`,
  });
}
