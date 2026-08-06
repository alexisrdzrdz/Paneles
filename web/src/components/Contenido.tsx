import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';

/* Las páginas del sitio se sirven desde web/content/*.html, extraídas del sitio
   original. Se inyecta el markup tal cual en vez de recopiarlo a JSX: así el
   diseño queda idéntico y no hay riesgo de transcripción. Es contenido propio
   del proyecto, no entrada de usuario. */
export async function Contenido({ pagina }: { pagina: string }) {
  let html: string | null = null;
  try {
    html = await readFile(join(process.cwd(), 'content', `${pagina}.html`), 'utf8');
  } catch {
    html = null;
  }
  /* Si el archivo no está, 404 limpio. Jamás un error con rutas del servidor
     en la cara del cliente. */
  if (html === null) notFound();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
