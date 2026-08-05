import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* Las páginas del sitio se sirven desde web/content/*.html, extraídas del sitio
   original. Se inyecta el markup tal cual en vez de recopiarlo a JSX: así el
   diseño queda idéntico y no hay riesgo de transcripción. Es contenido propio
   del proyecto, no entrada de usuario. */
export async function Contenido({ pagina }: { pagina: string }) {
  const html = await readFile(join(process.cwd(), 'content', `${pagina}.html`), 'utf8');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
