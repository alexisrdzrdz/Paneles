# Beta Particiones — plataforma de cotización

Sitio, cotizador 2D/3D, portal de clientes y panel de administración para un
taller de particiones de baño. Next.js + PostgreSQL.

## Desarrollo

```bash
docker compose up -d        # Postgres local (puerto 5433, desde la raíz del repo)
cd web
cp .env.example .env.local
npm install
npm run db:push             # crea el esquema
npm run seed:catalog        # piezas y reglas del tabulador (precios en $0)
npm run seed                # cuentas y proyecto de ejemplo
npm run dev
```

Scripts útiles: `npm run admin correo@x.com` da acceso de administrador;
`seed:precios-referencia` carga precios ancla de mercado;
`seed:precios-demo` carga precios sintéticos de prueba.

## Producción

- **Vercel**: conectar el repositorio (root directory `web`, framework
  Next.js) con `DATABASE_URL`, `APP_URL`, `MAIL_FROM` y `RESEND_API_KEY`.
- **cPanel / VPS**: `npm run build && npm run empaquetar` produce
  `dist-cpanel/` con un asistente de instalación web. Guía completa en
  [DESPLIEGUE.md](DESPLIEGUE.md).

## Estructura

- `src/app` — páginas (sitio público, portal, admin) y APIs
- `src/lib/bom.ts` — motor de despiece: geometría → piezas y costo
- `src/lib/cotizacion.ts` — validación y puente cotizador → motor
- `public/cotizador.html` — configurador 2D/3D independiente
- `content/` — HTML de las páginas públicas
- `scripts/` — seeds, empaquetador y utilidades de base
