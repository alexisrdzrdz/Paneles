/* eslint-disable @typescript-eslint/no-require-imports */
/* Arranque del paquete de producción (este archivo viaja como iniciar.js).

   Dos modos, decididos por la existencia de config.json:
   - SIN configurar → sirve el ASISTENTE DE INSTALACIÓN: pide base de datos,
     dominio, correo y la cuenta del administrador; crea las tablas, siembra
     el catálogo y escribe config.json. Protegido con la clave que viaja en
     clave-instalacion.txt: quien no tiene el archivo, no instala.
   - Configurado → carga config.json al entorno y arranca el sitio (server.js).

   En cPanel (Passenger) el "Application startup file" es este archivo. Al
   terminar la instalación el proceso se apaga solo; Passenger levanta el
   siguiente ya con el sitio real. */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = __dirname;
const CONFIG = path.join(RAIZ, 'config.json');
const PORT = Number(process.env.PORT) || 3000;

if (fs.existsSync(CONFIG)) {
  /* ── Modo sitio ──────────────────────────────────────────────────────
     Lo que venga del hosting (variables de cPanel) manda sobre config.json. */
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    for (const [k, v] of Object.entries(cfg)) {
      if (v && !process.env[k]) process.env[k] = String(v);
    }
  } catch (e) {
    console.error('config.json ilegible; usando solo variables de entorno.', e.message);
  }
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  require('./server.js');
} else {
  instalador();
}

function instalador() {
  const clave = leer('clave-instalacion.txt').trim();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/instalar') {
      let cuerpo = '';
      req.on('data', (c) => { cuerpo += c; if (cuerpo.length > 100_000) req.destroy(); });
      req.on('end', async () => {
        let datos;
        try { datos = JSON.parse(cuerpo); } catch { return json(res, 400, { error: 'Solicitud inválida.' }); }
        try {
          const r = await instalar(datos);
          json(res, 200, r);
          /* Passenger levanta el siguiente proceso ya en modo sitio. */
          setTimeout(() => process.exit(0), 1500);
        } catch (e) {
          json(res, 400, { error: e.message || 'Algo falló durante la instalación.' });
        }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGINA);
  });

  server.listen(PORT, () => console.log(`Asistente de instalación en el puerto ${PORT}`));

  async function instalar(d) {
    if (!clave || String(d.clave || '').trim() !== clave) {
      throw new Error('La clave de instalación no coincide. Está en clave-instalacion.txt, dentro del paquete que subiste.');
    }
    const dbUrl = String(d.dbUrl || '').trim();
    if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
      throw new Error('La cadena de la base debe empezar con postgres:// (revisa usuario, clave, host y nombre de la base).');
    }
    const appUrl = String(d.appUrl || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(appUrl)) throw new Error('La dirección del sitio debe empezar con https:// (o http:// en pruebas).');
    const mailFrom = String(d.mailFrom || '').trim();
    if (!mailFrom.includes('@')) throw new Error('El remitente de correo no parece válido. Ejemplo: Beta Particiones <no-reply@tudominio.com>');
    const adminNombre = String(d.adminNombre || '').trim();
    const adminCorreo = String(d.adminCorreo || '').trim().toLowerCase();
    const adminPass = String(d.adminPass || '');
    if (adminNombre.length < 2) throw new Error('Falta el nombre del administrador.');
    if (!adminCorreo.includes('@')) throw new Error('El correo del administrador no parece válido.');
    if (adminPass.length < 8) throw new Error('La contraseña del administrador necesita al menos 8 caracteres.');

    /* 1 · Conexión */
    const postgres = require('postgres');
    const sql = postgres(dbUrl, { max: 1, connect_timeout: 10 });
    try {
      await sql`select 1`;

      /* 2 · Esquema (solo si la base está virgen) */
      const [{ existe }] = await sql`select to_regclass('public.users') is not null as existe`;
      if (!existe) {
        const esquema = leer('esquema.sql');
        for (const paso of esquema.split('--> statement-breakpoint')) {
          const s = paso.trim();
          if (s) await sql.unsafe(s);
        }
      }

      /* 3 · Catálogo (solo si está vacío: no pisa precios ya capturados) */
      const [{ n }] = await sql`select count(*)::int as n from catalog_items`;
      let catalogo = { piezas: 0, reglas: 0 };
      if (n === 0) {
        const { sembrarCatalogo } = await import('./catalogo-datos.mjs');
        catalogo = await sembrarCatalogo(sql);
      }

      /* 4 · Administrador (mismos parámetros Argon2id que usa el sitio) */
      const { hash } = require('@node-rs/argon2');
      const passwordHash = await hash(adminPass, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
      await sql`
        insert into users (email, password_hash, name, role, email_verified_at)
        values (${adminCorreo}, ${passwordHash}, ${adminNombre}, 'admin', now())
        on conflict (email) do update
          set password_hash = ${passwordHash}, name = ${adminNombre},
              role = 'admin', email_verified_at = now(), updated_at = now()`;

      /* 5 · Configuración persistente */
      fs.writeFileSync(CONFIG, JSON.stringify({
        DATABASE_URL: dbUrl,
        APP_URL: appUrl,
        MAIL_FROM: mailFrom,
        RESEND_API_KEY: String(d.resendKey || '').trim(),
        NODE_ENV: 'production',
      }, null, 2));

      return {
        ok: true,
        detalle: existe
          ? 'La base ya tenía tablas: se conservaron los datos y solo se actualizó el administrador.'
          : `Base creada desde cero, catálogo con ${catalogo.piezas} piezas listo para capturar precios.`,
      };
    } finally {
      await sql.end({ timeout: 3 });
    }
  }

  function leer(nombre) {
    try { return fs.readFileSync(path.join(RAIZ, nombre), 'utf8'); } catch { return ''; }
  }

  function json(res, codigo, obj) {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  }
}

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Instalación · Beta Particiones</title>
<style>
  :root{--tinta:#191c22;--tenue:#6e7888;--linea:#dde1e6;--marca:#4a7c7b;--fondo:#f2f4f7;--tarjeta:#fff;--mal:#a33}
  @media (prefers-color-scheme:dark){:root{--tinta:#e8eaee;--tenue:#9aa2ad;--linea:#333a44;--marca:#6fa3a2;--fondo:#14171c;--tarjeta:#1c2027;--mal:#e08585}}
  *{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,'Segoe UI',sans-serif;color:var(--tinta);background:var(--fondo)}
  .caja{max-width:560px;margin:6vh auto;padding:0 16px}
  .tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:14px;padding:28px}
  h1{font-size:22px;margin:0 0 4px}h1 span{color:var(--marca)}
  p.sub{color:var(--tenue);margin:0 0 22px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--tenue);margin:26px 0 10px}
  label{display:block;font-size:13px;font-weight:600;margin:12px 0 4px}
  input{width:100%;padding:10px 12px;border:1px solid var(--linea);border-radius:8px;font:inherit;background:transparent;color:inherit}
  input:focus{outline:2px solid var(--marca);border-color:transparent}
  small{color:var(--tenue)}
  button{margin-top:24px;width:100%;padding:12px;border:0;border-radius:8px;background:var(--marca);color:#fff;font:600 15px/1 inherit;cursor:pointer}
  button:disabled{opacity:.6;cursor:wait}
  .aviso{display:none;margin-top:16px;padding:12px 14px;border-radius:8px;font-size:14px}
  .aviso.mal{display:block;background:color-mix(in srgb,var(--mal) 12%,transparent);color:var(--mal)}
  .aviso.bien{display:block;background:color-mix(in srgb,var(--marca) 14%,transparent)}
</style></head><body><div class="caja"><div class="tarjeta">
  <h1>Beta <span>PARTICIONES</span></h1>
  <p class="sub">Asistente de instalación — se ejecuta una sola vez.</p>
  <form id="f">
    <h2>Seguridad</h2>
    <label>Clave de instalación</label>
    <input name="clave" required autocomplete="off">
    <small>Está en <b>clave-instalacion.txt</b>, dentro del paquete que subiste.</small>

    <h2>Base de datos (PostgreSQL)</h2>
    <label>Cadena de conexión</label>
    <input name="dbUrl" required placeholder="postgres://usuario:clave@localhost:5432/particiones">
    <small>La armas con los datos de cPanel → PostgreSQL, o la copias de Neon.</small>

    <h2>Tu sitio</h2>
    <label>Dirección pública</label>
    <input name="appUrl" required placeholder="https://tudominio.com">
    <label>Remitente de los correos</label>
    <input name="mailFrom" required placeholder="Beta Particiones &lt;no-reply@tudominio.com&gt;">
    <label>Clave de Resend (opcional, para que salgan los correos)</label>
    <input name="resendKey" placeholder="re_...">
    <small>Sin ella el sitio funciona, pero nadie recibirá correos de confirmación.</small>

    <h2>Tu cuenta de administrador</h2>
    <label>Nombre</label>
    <input name="adminNombre" required>
    <label>Correo</label>
    <input name="adminCorreo" type="email" required>
    <label>Contraseña (mínimo 8 caracteres)</label>
    <input name="adminPass" type="password" minlength="8" required>

    <button type="submit">Instalar</button>
    <div class="aviso" id="aviso"></div>
  </form>
</div></div>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button'), aviso = document.getElementById('aviso');
  btn.disabled = true; btn.textContent = 'Instalando…'; aviso.className = 'aviso';
  const datos = Object.fromEntries(new FormData(e.target));
  try {
    const r = await fetch('/instalar', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'Algo falló.');
    aviso.className = 'aviso bien';
    aviso.innerHTML = '<b>✓ Instalado.</b> ' + (j.detalle || '') +
      ' El sitio se está reiniciando; en unos segundos <a href="/">recarga esta página</a> y entra con tu cuenta.';
    e.target.querySelectorAll('input,button').forEach((el) => { el.disabled = true; });
  } catch (err) {
    aviso.className = 'aviso mal';
    aviso.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Instalar';
  }
});
</script></body></html>`;
