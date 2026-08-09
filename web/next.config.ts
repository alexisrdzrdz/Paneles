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
  /* Cabeceras de seguridad para todo el sitio. Ponen el mínimo que espera
     cualquier auditoría moderna: nada de enmarcar el sitio en otro dominio
     (clickjacking), forzar HTTPS por un año, no adivinar tipos de contenido,
     no filtrar la URL completa al navegar afuera, y apagar APIs del navegador
     que este sitio no usa. */
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }];
  },
};

export default nextConfig;
