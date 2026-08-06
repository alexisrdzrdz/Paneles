import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Build autocontenido para cPanel/VPS: `next build` deja en .next/standalone
     un server.js con todo lo necesario. En Vercel NO: su empaquetador hace lo
     suyo y el modo standalone le rompe el rastreo (.nft.json ausente). */
  output: process.env.VERCEL ? undefined : 'standalone',
  /* Las páginas públicas leen web/content/*.html en tiempo de ejecución; el
     rastreo automático no las ve (la ruta se arma dinámicamente) y sin esto
     el standalone arranca sin la carpeta y /proyectos truena en producción. */
  outputFileTracingIncludes: {
    '/': ['content/**/*'],
    '/*': ['content/**/*'],
  },
};

export default nextConfig;
