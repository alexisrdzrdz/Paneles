# Nord · 04 ago 22:10 — cómo integrarlo

## 1 · Qué hay en el paquete

| Archivo | Qué es | ¿Obligatorio? |
|---|---|---|
| `theme.css` | Los **valores**: un bloque `:root` con los 201 tokens | sí |
| `framework.css` | Los **componentes**: todas las clases `ui-*` | sí |
| `layout.css` | El **armazón** de la aplicación | sí, este tema lo usa |
| `movimiento.css` | Las **transiciones** del sistema, con sus curvas | recomendado |
| `ui.js` | El **comportamiento**: pestañas, menús, diálogos, cajón, avisos, tema | si usas esos componentes |
| `demo.html` | Muestrario de componentes en una página | no, pero ábrela |
| `login.html` · `logout.html` · `dashboard.html` · `modulo.html` · `mapa.html` · `medios.html` · `social.html` · `mercados.html` · `sitio.html` | Páginas completas, listas para copiar | no |
| `map-theme.js` | Puente para que Mapbox siga al tema | solo con mapa |
| `design-system.json` | El sistema entero en JSON, para migrar | no |
| `COMO-APLICARLO.md` | Este documento | — |

**Empieza abriendo `demo.html`** con doble clic. No necesita servidor
ni nada instalado: si se ve como en el diseñador, el paquete está
completo y los enlaces son correctos. Y su marcado es el que puedes
copiar para tu propia página.

La división importa: **`theme.css` cambia, `framework.css` no.** Puedes
generar veinte temas en el diseñador e ir sustituyendo solo el primero;
el segundo es siempre el mismo archivo.

## 2 · Enlázalos, en este orden

```html
<link rel="stylesheet" href="theme.css">      <!-- 1. los valores -->
<link rel="stylesheet" href="framework.css">  <!-- 2. los componentes -->
<link rel="stylesheet" href="layout.css">     <!-- 3. el armazón -->
<link rel="stylesheet" href="movimiento.css"> <!-- 4. el movimiento -->
<script src="ui.js" defer></script>          <!-- el comportamiento -->
<script src="map-theme.js"></script>         <!-- solo si usas Mapbox -->
```

Y **pon `class="ui"` en el `<body>`** (o en el contenedor que envuelva tu
aplicación, si la estás metiendo dentro de un sitio que ya existe):

```html
<body class="ui" data-layout="sidebar" data-panel="card">
```

Todo el framework cuelga de esa clase. Es lo que te permite adoptarlo por
partes sin que se te descoloque el resto de la página.

`data-layout` decide cómo se comporta el armazón, y puedes cambiarlo desde
JavaScript sin recargar: `topbar` (sin menú lateral), `sidebar` (menú fijo),
`compact` (menú de iconos que se despliega al pasar el ratón) y `hamburger`
(cajón sobre el contenido; abre y cierra con la clase `is-open` en
`.ui-shell`). Este tema usa **`sidebar`**.

Detalles que evitan sorpresas:

- `framework.css` repite todos los tokens en un bloque `:where(.ui)` para no
  romperse si falta el tema. Por eso `theme.css` los declara en **`:root, .ui`**
  y no sólo en `:root`: el bloque del framework cae sobre tu `<body class="ui">`,
  y una declaración propia del `<body>` gana al valor que hereda del `<html>`
  por muy baja que sea su especificidad —son elementos distintos, no compiten—.
  Si recortas el selector a `:root`, tu tema deja de verse. Déjalo como está.
- `theme.css` es autosuficiente: trae **todos** los tokens, también los que
  estaban en Auto. No hay que conservar nada del tema anterior.
- No hay ningún `@import` ni ningún `build`. Son archivos estáticos: valen en
  un `file://`, en Apache o en un CDN.
- **Las tipografías no viajan dentro del `.zip`**: cada HTML las enlaza desde
  Google Fonts, y son las únicas que el tema usa. Es lo que hace que el
  archivo se vea con la letra con la que lo diseñaste — sin el enlace, el
  navegador cae en la siguiente de la pila (`Inter` → `system-ui`,
  `Barlow Condensed` → `Arial Narrow`) y cambian las métricas, los anchos y
  los cortes de línea. Si no quieres depender de Google, baja los `.woff2`,
  escribe tus `@font-face` y sustituye ese `<link>`: no hay que tocar nada más.

  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
  ```

## 3 · Escribe el marcado con estas clases

```html
<div class="ui-panel">
  <div class="ui-panel-head"><span class="ui-panel-title">Título</span></div>
  <div class="ui-panel-body">
    <p>Texto del panel.</p>
    <button class="ui-btn ui-btn-primary">Aceptar</button>
    <span class="ui-badge ui-badge-ok">LISTO</span>
  </div>
</div>
```

| Clase | Para qué |
|---|---|
| `ui-shell / ui-shell-nav / ui-shell-main / ui-shell-top` | Armazón de la aplicación |
| `ui-panel + ui-panel-head / ui-panel-title / ui-panel-body` | Tarjeta o panel |
| `ui-stat + ui-stat-value / ui-stat-label` | Indicador (KPI); .primary lo destaca |
| `ui-btn + ui-btn-primary / ui-btn-ghost / ui-btn-danger` | Botón; disabled y .is-focus incluidos |
| `ui-badge + ui-badge-ok / -warn / -danger / -info` | Etiqueta de estado |
| `ui-alert + ui-alert-ok / -warn / -danger / -info` | Aviso con fondo teñido |
| `ui-side + ui-side-item.active` | Navegación lateral |
| `ui-tabs + ui-tab.active` | Pestañas |
| `ui-menu + ui-menu-item / ui-menu-sep` | Menú desplegable |
| `ui-tooltip · ui-chip · ui-avatar` | Tooltip, chip y avatar |
| `ui-progress > span[style="width:N%"]` | Barra de progreso |
| `ui-pager + ui-page.is-active` | Paginación |
| `ui-dialog + ui-dialog-head / -body / -foot` | Diálogo modal |
| `ui-table` | Tabla; .num alinea a la derecha |
| `ui-check · ui-switch` | Casilla, radio e interruptor |
| `ui-link · ui-breadcrumb · ui-scrollbox` | Enlace, migas y área con scroll |

## 4 · El comportamiento: `ui.js`

El CSS no puede abrir un diálogo ni ordenar una tabla. `ui.js` es el
mínimo que hace falta para eso: un archivo, sin dependencias, que se
engancha una sola vez a `document` y funciona por delegación. Eso
significa que el marcado que aparezca **después** —una fila que llega
por AJAX, un diálogo que pintas con React— responde igual, sin volver a
inicializar nada.

```html
<script src="ui.js" defer></script>
```

No hay que llamar a nada. El comportamiento sale de atributos en el
marcado:

| Atributo | Qué hace |
|---|---|
| `data-ui-open="idDialogo"` | Abre ese `.ui-stage` |
| `data-ui-close` | Cierra la capa que lo contiene |
| `data-ui-drawer="idCajon"` | Abre y cierra un `.ui-drawer` |
| `data-ui-menu="idMenu"` | Despliega un `.ui-menu` |
| `data-ui-reveal` | Muestra u oculta la contraseña del campo hermano |
| `data-ui-sort` | Ordena la tabla por esa columna |
| `data-ui-row` | Marca la fila y abre su detalle |
| `data-ui-acc` | Cabecera de acordeón |
| `data-ui-remove` | Elimina el chip o la fila que lo contiene |
| `data-ui-countdown="10"` | Cuenta atrás en el texto del elemento |

Las pestañas funcionan solas con el patrón ARIA estándar: cada
`.ui-tab` con `aria-controls` apuntando al `id` de su panel. El
`.ui-burger` abre el menú en móvil, `.ui-shell-collapse` alterna entre
lateral y iconos, y `.ui-theme-toggle` cambia entre claro y oscuro y lo
recuerda.

Desde JavaScript tienes lo justo:

```js
UI.toast("Guardado", "ok");      // también "danger", o nada
UI.abrir("dlgConfirmar");
UI.cerrar();
UI.cajon("detalleRegistro");
UI.tema("light");                // sin argumento, alterna
```

Si usas React, Vue o Angular y ya resuelves las capas con tu propio
estado, **no enlaces `ui.js`**: el CSS no lo necesita para nada. Está
pensado para quien monta la página con HTML.

## 5 · El movimiento: `movimiento.css`

Es archivo aparte a propósito: `framework.css` se regenera y se
sustituye entero, así que lo que viviera dentro se perdería en cada
regeneración. Aparte sobrevive, y además se puede quitar de un enlace si
un despliegue lo quiere todo quieto.

Redeclara las transiciones del framework con las curvas del tema
(`--ease-standard`, `--ease-out`, `--ease-in`, `--ease-emphasis`) y añade
movimiento donde no lo había: capas, filas, pestañas, entrada escalonada
y cambio de vista. Las reglas que sigue, por si hay que ampliarlo:

- **El movimiento explica, no adorna.** Cada transición responde a una
  pregunta: ¿de dónde salió esto?, ¿esto reaccionó a lo que acabo de
  hacer? Lo que no responde a ninguna, sobra.
- **Nada supera los 320 ms.** Por encima, el usuario espera a la
  interfaz en lugar de al revés; los estados de hover van a 160 ms.
- **Nada se mueve en bucle**, salvo el indicador de estado vivo, acotado
  y por debajo del umbral de WCAG 2.2 SC 2.3.1.
- Se anima **`transform` y `opacity`**, que el compositor resuelve sin
  rehacer la maquetación en cada fotograma.
- Todo se apaga con **`prefers-reduced-motion`**.

## 6 · Ilustración animada (Lottie)

El paquete no trae dependencias y sus fondos animados cuestan **0 KB**:
van dentro de `fondo.js`. Pero si el diseño pide ilustración vectorial
animada —el estilo de lottiefiles.com: personajes, iconos que respiran,
estados vacíos con vida— el camino limpio es el reproductor oficial, no
un GIF ni un video:

```html
<script src="https://unpkg.com/@lottiefiles/dotlottie-wc@latest/dist/dotlottie-wc.js" type="module"></script>
<dotlottie-wc src="animacion.lottie" autoplay loop style="width:220px;height:220px"></dotlottie-wc>
```

Las reglas son las mismas que las del resto del movimiento: la
ilustración es **decorativa** —nunca bloquea ni sustituye un dato—, se
apaga con `prefers-reduced-motion` (envuelve el componente en un
`@media (prefers-reduced-motion: no-preference)`) y el reproductor pesa
**~50 KB**: enlázalo solo en las páginas que lo usen, no en la plantilla
base.

## 7 · Páginas completas, ya montadas

El paquete no trae sólo piezas sueltas: trae 9 páginas enteras,
con este tema aplicado y el mismo menú, la misma barra y los mismos
datos de ejemplo, para que se vean como un sistema y no como una
colección de demos.

- **`login.html`** — acceso con contraseña, recordarme, proveedores y error de credenciales
- **`logout.html`** — sesión cerrada, resumen de la sesión y volver a entrar
- **`dashboard.html`** — el tablero: KPIs, gráficas SVG, actividad y estado
- **`modulo.html`** — listado y detalle: filtros, tabla ordenable, cajón, vacío y carga
- **`mapa.html`** — mapa a pantalla completa con tarjetas HUD encima
- **`medios.html`** — página del sistema
- **`social.html`** — página del sistema
- **`mercados.html`** — página del sistema
- **`sitio.html`** — página del sistema

`dashboard.html` lleva **la composición que hiciste con «Componer»**:
el orden de las tarjetas es el orden de los `.ui-dash-card`, y el ancho
de cada una va en su `grid-column`. Está en el marcado y no en una hoja
aparte a propósito: así la composición no depende de `layout.css`, que
sólo viaja en algunos temas.

Ábrelas con doble clic. Son HTML plano: copia el trozo que te sirva o
usa el archivo entero como punto de partida. Las gráficas son SVG en
línea pintado con los tokens, así que cambian de color con el tema y no
hay ninguna imagen que reemplazar.

## 8 · Si necesitas un valor suelto, usa el token

Nunca escribas un color a mano: todo sale de una variable.

```css
.mi-componente {
  background: var(--surface);
  color: var(--ink);
  border: var(--border-width) solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}
.mi-componente--aviso {           /* fondo teñido + texto pleno */
  background: var(--warn-soft);
  color: var(--warn);
}
```

Los que más vas a usar:

- **Superficies**: `--bg` página · `--surface` tarjeta · `--surface-2` y `--surface-3` niveles · `--surface-inset` hundido
- **Texto**: `--ink-strong` titular · `--ink` normal · `--ink-dim` secundario · `--ink-faint` apagado
- **Estado**: `--ok` `--warn` `--danger` `--info` y sus `-soft` para el fondo
- **Forma**: `--radius-sm` campos · `--radius-md` tarjetas · `--radius-lg` paneles · `--radius-pill` píldoras
- **Espacio**: `--space-1` a `--space-6` · `--content-pad` el margen de la página
- **Elevación**: `--shadow-sm` tarjeta · `--shadow-md` menú · `--shadow-lg` modal
- **Alturas**: `--btn-h` `--input-h` `--row-h`, multiplicadas por `--density`

## 9 · Integrarlo en tu proyecto

Todo lo que sigue parte del mismo sitio: son dos hojas de estilo y una
clase en el contenedor. Lo que cambia es dónde las pones.

### HTML plano / PHP / cualquier servidor

Copia los archivos a `css/` y enlázalos en tu plantilla:

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/framework.css">
  <link rel="stylesheet" href="/css/layout.css">
</head>
<body class="ui">
  <!-- tu contenido, con las clases ui-* -->
</body>
</html>
```

En PHP es el mismo bloque dentro de tu `header.php` o del layout de
Laravel/Symfony. No hace falta nada más.

### React (Vite, CRA) y Vue

Mete los CSS en `src/estilos/` e impórtalos **una sola vez**, en el punto
de entrada. El orden del import es el orden en que se aplican:

```js
// src/main.jsx  (o main.js en Vue)
import "./estilos/theme.css";
import "./estilos/framework.css";
import "./estilos/layout.css";
```

Y la clase en la raíz — en `index.html` o en tu componente de más arriba:

```jsx
export default function App() {
  return (
    <div className="ui">
      <div className="ui-panel">
        <div className="ui-panel-head"><span className="ui-panel-title">Título</span></div>
        <div className="ui-panel-body">
          <button className="ui-btn ui-btn-primary">Aceptar</button>
        </div>
      </div>
    </div>
  );
}
```

Con **CSS Modules** o **styled-components** no hay conflicto: estos dos
archivos son globales a propósito y no llevan `:global` ni nada que
haya que desactivar.

### Next.js (App Router)

Los CSS globales solo se pueden importar desde `app/layout.tsx`:

```tsx
// app/layout.tsx
import "./theme.css";
import "./framework.css";
import "./layout.css";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="ui">{children}</body>
    </html>
  );
}
```

En el **Pages Router** es igual pero desde `pages/_app.tsx`, y la clase
va en `pages/_document.tsx`.

### Angular

En `angular.json`, dentro de `build.options.styles`, **antes** de tus
propios estilos:

```json
"styles": [
  "src/estilos/theme.css",
  "src/estilos/framework.css",
  "src/estilos/layout.css",
  "src/styles.scss"
]
```

La clase `ui` va en el `<body>` de `src/index.html`. Ojo con la
encapsulación de vistas: si un componente usa `ViewEncapsulation.Emulated`
(el valor por omisión) sus estilos propios ganan a los del framework, que
es justo lo que quieres.

### Tailwind

Los dos conviven sin pelearse: el framework usa clases `ui-*` y Tailwind
usa las suyas. Enlaza `theme.css` y expón los tokens como colores del
tema para poder escribir `bg-surface` o `text-ink`:

```js
// tailwind.config.js
theme: { extend: {
  colors: {
    bg: "var(--bg)", surface: "var(--surface)", ink: "var(--ink)",
    accent: "var(--accent)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)",
  },
  borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)" },
  boxShadow: { sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)" },
  spacing: { 1: "var(--space-1)", 2: "var(--space-2)", 3: "var(--space-3)", 4: "var(--space-4)" },
} }
```

Si solo quieres los tokens y no los componentes, enlaza `theme.css` y
olvídate de `framework.css`. Es una decisión válida y no rompe nada.

### SCSS / Sass

```scss
@use "theme.css";
@use "framework.css";

// Los tokens siguen siendo variables CSS, así que se leen en caliente:
.mi-tarjeta {
  background: var(--surface);
  border-radius: var(--radius-md);
  // …y si necesitas operar con ellos en tiempo de compilación,
  // genera el mapa Sass desde design-system.json con un script.
}
```

### WordPress

En el `functions.php` del tema (o del tema hijo):

```php
add_action('wp_enqueue_scripts', function () {
  $u = get_stylesheet_directory_uri();
  wp_enqueue_style('ui-theme',     "$u/css/theme.css",     [], '1.0');
  wp_enqueue_style('ui-framework', "$u/css/framework.css", ['ui-theme'], '1.0');
  wp_enqueue_style('ui-layout',    "$u/css/layout.css",    ['ui-framework'], '1.0');
});

// La clase en el <body>
add_filter('body_class', fn($c) => array_merge($c, ['ui']));
```

El tercer parámetro (`['ui-theme']`) es la dependencia: así WordPress
garantiza el orden aunque otro plugin encole cosas por medio.

### Django / Flask / Rails

Archivos estáticos normales. En Django:

```html
{% load static %}
<link rel="stylesheet" href="{% static 'css/theme.css' %}">
<link rel="stylesheet" href="{% static 'css/framework.css' %}">
```

### Dentro de un sitio que ya existe

Este es el caso delicado y la razón de que todo cuelgue de `.ui`. Si
metes el framework en una página con estilos propios, **no pongas la
clase en el `<body>`**: ponla solo en la parte que quieras convertir.

```html
<div class="ui">           <!-- de aquí para dentro, manda el framework -->
  <div class="ui-panel">…</div>
</div>
```

Fuera de ese contenedor no se toca nada. Y si el CSS que ya tenías pisa
algo de dentro, sube la especificidad de esa regla concreta en vez de
editar `framework.css`: así el archivo sigue siendo reemplazable cuando
generes otra versión.

## 10 · SDK: el sistema como datos

`design-system.json` lleva **todo** el sistema en formato legible por
máquina: cada token con su valor resuelto, su tipo, su unidad, su grupo y
si hereda; más la marca en HSL/RGB, el armazón, la composición del tablero
y el tema del mapa. Es el archivo que te llevas para migrar a otra
herramienta, para alimentar un generador o para cambiar de tema en
caliente sin recargar la página.

```js
import ds from "./design-system.json";

// 1 · Inyectarlo como variables CSS en tiempo de ejecución
const raiz = document.documentElement;
for (const [nombre, t] of Object.entries(ds.tokens)) raiz.style.setProperty(nombre, t.css);

// 2 · Leer un valor concreto sin tocar el DOM
ds.tokens["--accent"].valor        // "#85999d"
ds.armazon.tipo                    // "sidebar"
ds.tablero.tarjetas[0].columnas    // 1
```

## 11 · Día y noche

Marca «Incluir el tema contrario» en el panel de archivos y el `theme.css`
traerá los dos, con cambio automático y `<html data-theme="…">` para forzarlo.

## 12 · Este tema, en cifras

| | |
|---|---|
| Modo | claro |
| Armazón | Menú lateral fijo |
| Radio de tarjeta | 6px |
| Grosor de borde | 1px |
| Densidad | ×1 |
| Cuerpo | 'Inter', system-ui, sans-serif a 14px |
| Curvas | 4 (`--ease-standard`, `-out`, `-in`, `-emphasis`) |
