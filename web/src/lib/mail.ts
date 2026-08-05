import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Mail = { to: string; subject: string; html: string; text: string };

const FROM = process.env.MAIL_FROM ?? 'Mauricios Particiones <no-reply@localhost>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/* Sin API key el correo no se pierde: se escribe en web/.mail/ y el enlace se
   imprime en la consola. Así se prueba registro y verificación en local sin
   dar de alta un proveedor. */
async function deliverToDisk(mail: Mail) {
  const dir = join(process.cwd(), '.mail');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${stamp}-${mail.to.replace(/[^a-z0-9]/gi, '_')}.html`);
  await writeFile(file, mail.html, 'utf8');
  const link = /href="([^"]+)"/.exec(mail.html)?.[1];
  console.log(`\n📧  ${mail.subject}  →  ${mail.to}`);
  console.log(`    ${file}`);
  if (link) console.log(`    Enlace: ${link}\n`);
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
  <h1 style="font-size:20px;margin:0 0 4px">Mauricios <span style="color:#4a7c7b">Particiones</span></h1>
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
    subject: 'Confirma tu correo · Mauricios Particiones',
    html: shell('Confirmación de correo', `
      <p>Hola ${name}, ya casi está. Confirma tu correo para activar tu cuenta
         y poder guardar y dar seguimiento a tus proyectos.</p>
      ${button(href, 'Confirmar mi correo')}
      <p style="color:#6e7888;font-size:12px">El enlace caduca en 24 horas.</p>`),
    text: `Hola ${name}, confirma tu correo: ${href} (caduca en 24 horas)`,
  });
}

export function passwordResetMail(to: string, name: string, token: string) {
  const href = `${APP_URL}/restablecer?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Restablece tu contraseña · Mauricios Particiones',
    html: shell('Recuperación de contraseña', `
      <p>Hola ${name}, recibimos una solicitud para cambiar tu contraseña.</p>
      ${button(href, 'Elegir contraseña nueva')}
      <p style="color:#6e7888;font-size:12px">El enlace caduca en 1 hora.
         Si no fuiste tú, tu contraseña actual sigue funcionando.</p>`),
    text: `Hola ${name}, restablece tu contraseña: ${href} (caduca en 1 hora)`,
  });
}
