import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Build autocontenido: `next build` deja en .next/standalone un server.js
     con todo lo necesario. Es lo que se sube al hosting (cPanel/Passenger o
     un VPS) junto con .next/static y public/. */
  output: 'standalone',
  /* Las páginas públicas leen web/content/*.html en tiempo de ejecución; el
     rastreo automático no las ve (la ruta se arma dinámicamente) y sin esto
     el standalone arranca sin la carpeta y /proyectos truena en producción. */
  outputFileTracingIncludes: {
    '/': ['content/**/*'],
    '/*': ['content/**/*'],
  },
};

export default nextConfig;
