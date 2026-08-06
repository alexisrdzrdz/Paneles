/* Arma la carpeta lista para subir al hosting: dist-cpanel/.
   Uso:  npm run empaquetar   (corre tras el build y junta las piezas)
   El paquete trae su ASISTENTE DE INSTALACIÓN: en cPanel el arranque apunta a
   iniciar.js; la primera visita al dominio muestra el asistente (protegido
   con la clave de clave-instalacion.txt) y al terminar arranca el sitio.
   Los pasos completos están en web/DESPLIEGUE.md. */
import { cpSync, rmSync, existsSync, writeFileSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const standalone = join(raiz, '.next', 'standalone');
const destino = join(raiz, 'dist-cpanel');

if (!existsSync(standalone)) {
  console.error('No existe .next/standalone. Corre primero: npm run build');
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(standalone, destino, { recursive: true });
/* El standalone NO incluye ni los estáticos del build ni public/: van aparte. */
cpSync(join(raiz, '.next', 'static'), join(destino, '.next', 'static'), { recursive: true });
cpSync(join(raiz, 'public'), join(destino, 'public'), { recursive: true });
/* Cinturón y tirantes: las páginas públicas leen content/ en runtime. */
if (!existsSync(join(destino, 'content'))) {
  cpSync(join(raiz, 'content'), join(destino, 'content'), { recursive: true });
}

/* Asistente de instalación y lo que necesita. */
cpSync(join(raiz, 'scripts', 'iniciar-produccion.js'), join(destino, 'iniciar.js'));
cpSync(join(raiz, 'scripts', 'catalogo-datos.mjs'), join(destino, 'catalogo-datos.mjs'));

/* Esquema: todas las migraciones de drizzle/ en orden, en un solo archivo. */
const dirMigraciones = join(raiz, 'drizzle');
const migraciones = existsSync(dirMigraciones)
  ? readdirSync(dirMigraciones).filter((f) => f.endsWith('.sql')).sort()
  : [];
if (!migraciones.length) {
  console.error('No hay migraciones en web/drizzle/. Corre: npx drizzle-kit generate');
  process.exit(1);
}
writeFileSync(join(destino, 'esquema.sql'),
  migraciones.map((f) => readFileSync(join(dirMigraciones, f), 'utf8')).join('\n--> statement-breakpoint\n'));

/* Clave del asistente: viaja en el paquete; quien no lo tiene, no instala. */
const clave = randomBytes(4).toString('hex');
writeFileSync(join(destino, 'clave-instalacion.txt'), clave + '\n');

/* `postgres` va empaquetado dentro de los chunks del sitio, pero el asistente
   lo necesita como módulo suelto. Es JS puro y sin dependencias: se copia. */
cpSync(join(raiz, 'node_modules', 'postgres'), join(destino, 'node_modules', 'postgres'), { recursive: true });

/* El binario de Argon2 es NATIVO y el build de Windows solo trae el de
   Windows: sin los de Linux, en cPanel nadie podría iniciar sesión. Se bajan
   una vez (gnu y musl) y se quedan en caché para los siguientes empaques. */
const versionArgon = JSON.parse(
  readFileSync(join(raiz, 'node_modules', '@node-rs', 'argon2', 'package.json'), 'utf8')).version;
const cacheBin = join(raiz, '.cache-bindings');
mkdirSync(cacheBin, { recursive: true });
for (const pkg of ['@node-rs/argon2-linux-x64-gnu', '@node-rs/argon2-linux-x64-musl']) {
  const tgz = join(cacheBin, `${pkg.replace('@', '').replace('/', '-')}-${versionArgon}.tgz`);
  if (!existsSync(tgz)) {
    console.log(`Descargando ${pkg}@${versionArgon}…`);
    execSync(`npm pack ${pkg}@${versionArgon} --pack-destination "${cacheBin}"`, { stdio: 'pipe' });
  }
  const dirMod = join(destino, 'node_modules', ...pkg.split('/'));
  mkdirSync(dirMod, { recursive: true });
  /* Ruta RELATIVA y cwd: el tar de Git Bash lee "c:" como host remoto. */
  execSync(`tar -xzf "${relative(dirMod, tgz)}" --strip-components=1`, { cwd: dirMod });
}

/* Sin estas piezas el paquete no sirve: mejor reventar aquí que en el hosting. */
for (const mod of ['postgres', '@node-rs/argon2', '@node-rs/argon2-linux-x64-gnu']) {
  if (!existsSync(join(destino, 'node_modules', mod))) {
    console.error(`Falta node_modules/${mod}: el paquete quedaría cojo.`);
    process.exit(1);
  }
}

/* Nunca se empaqueta el .env de desarrollo (las variables van en config.json
   que escribe el asistente), ni correos de prueba, ni una config previa. */
rmSync(join(destino, '.env.local'), { force: true });
rmSync(join(destino, '.env'), { force: true });
rmSync(join(destino, '.mail'), { recursive: true, force: true });
rmSync(join(destino, 'config.json'), { force: true });

writeFileSync(join(destino, 'LEEME.txt'), [
  'Paquete de producción de Beta Particiones — con asistente de instalación.',
  '',
  '1. Sube este contenido a la carpeta de la app en cPanel.',
  '2. Setup Node.js App → startup file: iniciar.js → Node 20.9+ → Restart.',
  '3. Abre tu dominio: aparece el asistente de instalación.',
  `4. La clave que te pedirá está en clave-instalacion.txt (esta copia: ${clave}).`,
  '5. Al terminar, recarga la página: ya es tu sitio.',
  '',
  'La guía completa está en DESPLIEGUE.md del repositorio.',
  '',
].join('\n'));

console.log(`Listo: ${destino}`);
console.log(`Clave de instalación: ${clave}`);
console.log('Comprime su CONTENIDO en un zip y súbelo a cPanel. Guía: web/DESPLIEGUE.md');
