# Desplegar Mauricios Particiones en cPanel

El paquete trae un **asistente de instalación**: subes el zip, apuntas el
arranque a `iniciar.js` y el propio sitio te guía para conectar la base,
configurar el correo y crear tu cuenta de administrador. Sin consola.

## Requisitos del hosting (verifícalos antes de empezar)

1. **"Setup Node.js App"** en cPanel (viene con CloudLinux/Passenger).
2. **Node 20.9 o más nuevo** (Next 16 no corre en menos).
3. **PostgreSQL**. Si el plan solo trae MySQL, crea la base gratis en
   [Neon](https://neon.tech) y usa esa cadena de conexión; cPanel solo corre la app.

## 1. Generar el zip (en tu máquina)

```bash
cd web
npm run build && npm run empaquetar
```

Deja todo en `web/dist-cpanel/` y te imprime la **clave de instalación**
(también queda en `dist-cpanel/clave-instalacion.txt`). Comprime el
**contenido** de esa carpeta en un zip.

## 2. Base de datos

En cPanel → **PostgreSQL Databases**: crea la base y el usuario, y apunta los
datos. La cadena queda así:

```
postgres://USUARIO:CLAVE@localhost:5432/NOMBRE_BASE
```

(Con Neon, copia la cadena que te da su panel.)

## 3. Subir y arrancar

1. Sube el zip con el administrador de archivos a la carpeta de la app
   (p. ej. `~/app-mauricios`) y descomprímelo ahí.
2. cPanel → **Setup Node.js App** → Create Application:
   - Node version: **20.x o superior**
   - Application root: `app-mauricios`
   - Application startup file: **`iniciar.js`**
   - Modo: Production
3. Restart, y abre tu dominio.

## 4. El asistente hace el resto

Al abrir el dominio verás el asistente. Te pide:

- la **clave de instalación** (paso 1),
- la **cadena de la base** (paso 2),
- tu **dominio** y el **remitente de correo** — y la clave de
  [Resend](https://resend.com) si ya la tienes (puede agregarse después),
- tu **cuenta de administrador**.

Con eso crea las tablas, siembra el catálogo (con precios en $0), crea tu
usuario y guarda la configuración en `config.json`. Recarga la página y el
sitio ya está andando. El asistente no vuelve a aparecer.

## 5. Después de instalar

1. **HTTPS**: activa AutoSSL en cPanel (SSL/TLS Status → Run AutoSSL). Sin
   HTTPS la cookie de sesión no viaja y nadie puede entrar.
2. **Correo**: crea la cuenta en Resend, verifica tu dominio (SPF y DKIM en
   Zone Editor) y pega la clave — en el asistente, o después editando
   `config.json` y haciendo Restart. Sin ella, nadie recibe el correo de
   confirmación de cuenta.
3. **Precios**: entra con tu cuenta → `/admin` y captura el precio real de
   cada pieza del tabulador.
4. Prueba de humo: crea una cuenta de cliente real, confirma el correo,
   cotiza un baño y envíalo; debe aparecer en `/admin/solicitudes`.

## Actualizar a una versión nueva

`npm run build && npm run empaquetar`, sube el zip nuevo y descomprime encima
**sin borrar `config.json`** (ahí vive tu configuración). Restart. Si hubo
cambios de esquema, desde tu máquina:
`DATABASE_URL="..." npm run db:push` antes del Restart.

## Alternativa sin asistente

Puedes saltarte el asistente configurando las variables directamente en
cPanel (Setup Node.js App → Environment): `DATABASE_URL`, `APP_URL`,
`MAIL_FROM`, `RESEND_API_KEY`, `NODE_ENV=production` — y aplicando el esquema
desde tu máquina con `npm run db:push` + `npm run seed:catalog` +
`npm run admin`. Las variables del hosting siempre mandan sobre `config.json`.
