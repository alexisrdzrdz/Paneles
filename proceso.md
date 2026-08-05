# Especificación de referencia — Sitio de particiones de baño con cotizador inteligente

**Propósito:** documento de referencia (sin código) que define todas las secciones del sitio y el proceso completo del cotizador, tomando como base el modelo de OnePointPartitions.com pero perfeccionado en cada punto. Sirve como guía para diseño y desarrollo.

**Principio rector:** conservar lo que hace funcionar al original — el esquema "a prueba de errores" con opciones cerradas, el canvas con vista previa en vivo y el cierre con precios reales — y perfeccionar la ejecución: precio visible desde el primer paso, material y color reflejados en el dibujo, todo en un solo dominio con una sola identidad visual.

---

## PARTE 1 — Estructura del sitio (mapa y secciones)

### 1.1 Mapa del sitio

| Página | Ruta | Función |
|---|---|---|
| Inicio | `/` | Convertir visitantes hacia el cotizador |
| Cotizador | `/cotizador` | Herramienta central (mismo dominio, no subdominio) |
| Materiales | `/materiales` + `/materiales/{material}` | Educar y comparar; landing SEO por material |
| Industrias | `/industrias/{sector}` | Landing SEO por sector (escuelas, hoteles, oficinas, iglesias, gimnasios, restaurantes) |
| Proyectos | `/proyectos` | Galería de instalaciones reales con ficha (sector, material, nº cabinas) |
| Recursos | `/recursos` | Guía de medición, guía ADA, preguntas frecuentes, blog |
| Muestras | `/muestras` | Solicitud de muestras físicas gratuitas |
| Subir planos | `/planos` | Alternativa al cotizador: cargar plano propio |
| Nosotros | `/nosotros` | Historia, equipo, certificaciones |
| Contacto | `/contacto` | Teléfono, WhatsApp, correo, formulario |
| Portal de cliente | `/mi-pedido/{codigo}` | Estado del pedido post-venta |
| Proyecto guardado | `/p/{codigo}` | Enlace compartible de cada cotización |

Reglas globales: una sola llamada a la acción primaria por pantalla ("Cotizar ahora"); teléfono y WhatsApp visibles en el encabezado; bilingüe ES/EN con selector persistente; URLs limpias sin parámetros de tracking visibles; carga objetivo < 2 s en móvil.

### 1.2 Página de inicio, sección por sección

1. **Encabezado (fijo):** logo, 5 enlaces máximo (Cotizador, Materiales, Industrias, Proyectos, Contacto), selector de idioma, botón primario "Cotizar ahora". *Mejora vs. original: su menú tiene 10+ entradas y duplicados; aquí se reduce a un embudo claro.*
2. **Hero:** titular orientado al beneficio ("Diseña y cotiza tus particiones en minutos, con precio al instante"), subtítulo de una línea, botón al cotizador y botón secundario "Ver cómo funciona". Al lado, **vista previa animada del cotizador real** (no foto genérica): un mini-canvas que muestra un baño configurándose solo, con el precio actualizándose. *Mejora: demuestra el producto desde el segundo cero.*
3. **Barra de confianza:** proyectos entregados, calificación promedio con enlace a reseñas, años de garantía máxima, logos de 4–6 clientes reconocibles. Una sola línea, sin sección aparte.
4. **Cómo funciona (3 pasos):** configura tu espacio → ve precio y diseño en vivo → formaliza con un experto. Cada paso con una captura real de la herramienta. *Mejora: el original describe su proceso en texto; aquí se muestra.*
5. **Cotizador embebido o acceso directo:** el propio wizard puede iniciarse desde la portada (paso 1 embebido); al interactuar, transición a pantalla completa. *Mejora clave: elimina el salto a subdominio.*
6. **Materiales (resumen):** 5 tarjetas con foto real, rango de precio relativo ($–$$$$), garantía y uso recomendado; enlace a la página de cada material.
7. **Prueba social:** 3 testimonios seleccionados con nombre, empresa y sector + calificación agregada. *Mejora: el original lista muchos testimonios y 10 fotos de empleados en la portada; aquí la portada se mantiene ligera y el equipo vive en /nosotros.*
8. **Industrias:** 6 tarjetas-enlace a las landings por sector.
9. **CTA final:** franja con "¿Listo? Obtén tu precio en 3 minutos" + botón.
10. **Pie de página:** navegación completa, datos legales, certificaciones, redes, contacto.

### 1.3 Páginas de apoyo (contenido mínimo)

- **Materiales:** cada material con fotos reales de instalaciones, tabla de resistencia (humedad, vandalismo, rayado), garantía, colores disponibles, rango de precio por cabina y botón "Cotizar con este material" (entra al wizard con el material preseleccionado).
- **Industrias:** cada sector con sus necesidades típicas (p. ej. escuelas → antivandálico; gimnasios → resistencia a humedad), proyectos de ejemplo y el cotizador enlazado con parámetros sugeridos.
- **Recursos / Guía de medición:** página con diagramas de cómo medir un baño existente, descargable en PDF; es el contenido que más reduce errores en cotizaciones.
- **Subir planos:** zona de arrastrar y soltar con vista previa del archivo, confirmación inmediata en pantalla y por correo, y promesa de tiempo de respuesta ("propuesta en 24 h hábiles"). *Mejora: el original acepta planos por formulario simple, correo o fax, sin confirmación visible.*

---

## PARTE 2 — El cotizador perfeccionado (proceso completo)

### 2.0 Reglas de experiencia que aplican a todo el wizard

- **Mismo dominio y misma marca** que el sitio; la barra del navegador nunca "cambia de sitio".
- **Esquema a prueba de errores (conservado del original):** ninguna entrada libre; solo contadores, tarjetas, dropdowns con valores estándar y selección sobre el dibujo. El usuario nunca puede introducir un dato inválido.
- **Precio siempre visible (la gran mejora):** un panel-resumen fijo (lateral en escritorio, barra inferior plegable en móvil) muestra desde el paso 1 el estimado acumulándose en vivo con cada elección, con desglose. Sin pedir correo para verlo.
- **Canvas siempre visible y siempre "vestido":** la vista previa 2D acompaña todos los pasos y, desde que se elige material/color, el dibujo se pinta con esa selección. Toggle 2D/3D en todos los pasos (el original lo tiene: se conserva).
- **Guardado automático:** cada proyecto genera un código y un enlace `/p/{codigo}` compartible desde cualquier paso; retomable sin registro. *(Sustituye al "Job Number que llega por email" del original.)*
- **Progreso claro:** barra de 5 pasos con estados pendiente/activo/completado, clicable para volver atrás sin perder datos.
- **Ayuda contextual, no páginas aparte:** notas breves donde se necesitan ("¿cómo medir la profundidad?", "qué exige ADA"), con ilustración emergente.
- **Móvil de primera:** controles táctiles grandes, canvas arriba y opciones abajo, todo el flujo completable con el pulgar.

### 2.1 Paso 1 — Tu espacio

**Qué ve el usuario:** canvas con el baño dibujándose en vivo + panel de opciones.

- Nombre del espacio (opcional, precargado como "Baño 1"; se puede renombrar).
- Contadores − / + para: cabinas de inodoro, pantallas de urinal, pantallas de privacidad. El canvas agrega/quita elementos con una animación breve en cada clic *(conservado del original, que lo hace bien)*.
- Interruptor "Incluir cabina accesible (ADA)": al activarlo, el canvas convierte la cabina del extremo en una cabina ancha con símbolo de accesibilidad y el resumen agrega el kit ADA.
- Botón "Agregar otro baño" para proyectos con varios espacios; cada baño aparece como pestaña sobre el canvas.

**Mejoras vs. original:** el panel lateral no se desperdicia en teléfono y correo de ventas (eso vive en un botón discreto de ayuda); el precio ya está corriendo en el resumen; ADA se decide aquí y no como filtro escondido en el paso de layouts.

### 2.2 Paso 2 — Distribución (layout)

- Galería de layouts estándar en tarjetas con miniatura del dibujo **generada con los datos del propio usuario** (sus cantidades, su cabina ADA), no ilustraciones genéricas de 4 inodoros.
- Familias: en línea contra pared, esquina izquierda/derecha, entre muros, variantes ADA — el sistema **solo muestra los layouts compatibles** con lo elegido en el paso 1, en lugar de filtros manuales Show All / ADA Only / Non-ADA.
- Al pasar el cursor (o tocar), la tarjeta muestra una nota de cuándo conviene ese layout ("aprovecha dos paredes; ideal en espacios cuadrados").
- Toggle 2D/3D en el canvas principal.

**Mejoras vs. original:** filtrado automático en vez de manual; miniaturas personalizadas; recomendación contextual por layout.

### 2.3 Paso 3 — Medidas

El paso más fuerte del original, conservado y refinado:

- **Selección por elemento sobre el dibujo:** clic o toque en cualquier cabina/pantalla del canvas para editarla individualmente ("Personalizar cabina 2"), con la cabina resaltada *(conservado)*.
- Opciones cerradas por elemento: profundidad de partición, ancho de cabina, apertura de puerta (izquierda/derecha, hacia adentro/afuera), posición de puerta e inodoro — dropdowns con valores estándar *(conservado)*.
- **Cotas en vivo sobre el dibujo** (ancho total, profundidad, ancho por cabina, vano de puerta) que se actualizan con cada cambio *(conservado)*.
- **Edición directa sobre la cota:** tocar una cota abre un selector con los valores estándar permitidos — el canvas deja de ser solo ilustrativo y se vuelve editable. *(Mejora principal de este paso.)*
- **Validación ADA automática:** si una medida rompe el mínimo (p. ej. cabina accesible < 60"), la cota se marca en rojo con explicación y el botón Continuar indica qué corregir. La cabina ADA se autoconfigura con puerta hacia afuera.
- Modo "no sé mis medidas": botón que aplica medidas estándar y lo anota en la cotización para verificación posterior; alternativa de subir plano sin salir del wizard.
- Pantallas de urinal y privacidad se editan igual (profundidad, tipo de soporte: poste, muro, colgante).

### 2.4 Paso 4 — Material y color (nuevo lugar en el flujo)

En el original el material aparece hasta la pantalla final y el color nunca toca el dibujo. Aquí se integra al diseño:

- Tarjetas comparativas de los 5 materiales con foto real, garantía, resistencia, tiempo de entrega y **el precio total del proyecto del usuario calculado para cada material** — la comparación que el original deja para el final, aquí alimenta la decisión con el proyecto ya configurado.
- Paleta de colores del material elegido; **al seleccionar, el canvas 2D/3D pinta el baño del usuario con ese color y textura**.
- Botones por material: ficha técnica, video, elevaciones (conservados del original como ventanas emergentes, sin abandonar el wizard).
- Enlace "Recibe hasta 5 muestras físicas gratis" que agrega las muestras al final del proceso sin desviar el flujo.

### 2.5 Paso 5 — Tu cotización

Cierre con la fortaleza del original (números reales) más transparencia y opciones de continuidad:

- **Resumen visual:** el dibujo final del baño en el material y color elegidos, con medidas.
- **Desglose completo en pantalla** (sin obligar a "revisar tu inbox"): particiones por cabina, kit ADA, pantallas, herrajes, envío estimado por código postal, total con rango (estimado ± ajuste tras revisión de planos). Comparativa colapsable "este mismo proyecto en otros materiales".
- Código postal como único dato requerido para afinar el envío.
- Acciones, en este orden de prominencia:
  1. **Ordenar ahora** (proyectos estándar) o **Solicitar cotización formal** (proyectos con revisión) — aquí sí se piden datos de contacto, con el mínimo de campos.
  2. **Descargar PDF** de la cotización con el dibujo incluido.
  3. **Compartir enlace** del proyecto (para el jefe, el cliente o el instalador).
  4. Enviar por correo (opcional, no obligatorio).
- La cotización conserva número de proyecto y validez visible ("precio garantizado 30 días").
- Si el usuario abandona sin ordenar, el proyecto queda accesible por su enlace; si dejó correo voluntariamente, recibe un recordatorio único con el enlace.

### 2.6 Después de la cotización (proceso de pedido)

Los 4 pasos del original (aprobación de diseño → color → envío → pago) se conservan pero con seguimiento en línea:

1. **Aprobación de planos:** el cliente recibe el plano de producción en su portal y lo aprueba con un clic (o solicita cambios anotando sobre el dibujo).
2. **Confirmación de material/color:** ya viene del wizard; solo se ratifica.
3. **Envío:** fecha estimada visible en el portal, con actualización automática y guía de rastreo.
4. **Pago:** en línea (tarjeta/transferencia) o contra orden de compra para clientes empresariales.
5. **Portal `/mi-pedido/{codigo}`:** línea de tiempo del pedido (diseño aprobado → producción → tránsito → entregado) que elimina el ping-pong de correos y llamadas.

---

## PARTE 3 — Resumen de mejoras respecto al original

| Aspecto | Original (OnePoint) | Versión perfeccionada |
|---|---|---|
| Dominio | Cotizador en subdominio aparte, URL con tracking | Todo en un dominio, URLs limpias |
| Precio | Solo en pantalla final, atado al correo | Visible y acumulándose desde el paso 1, sin correo |
| Canvas | 2D/3D con cotas en vivo, siempre gris | Igual + pintado con material/color elegidos |
| Edición de medidas | Solo dropdowns laterales | Dropdowns + edición tocando las cotas del dibujo |
| Filtro ADA | Manual (Show All / ADA Only) | Automático según configuración + validación de mínimos |
| Material | Se elige al final, sin verse en el diseño | Dentro del wizard, comparado con precios del proyecto propio |
| Guardar/compartir | Job Number por email, imprimir | Enlace compartible + PDF con dibujo + retomar sin registro |
| Layouts | Ilustraciones genéricas | Miniaturas generadas con los datos del usuario |
| Post-venta | Teléfono y correos | Portal con línea de tiempo del pedido |
| Portada | 13+ secciones, equipo completo visible | 10 secciones enfocadas al embudo, demo del cotizador en el hero |
| Móvil | Adaptado | Diseñado primero para táctil (canvas + pulgar) |

**Qué se conserva deliberadamente del original:** el wizard de pasos con barra de progreso, el esquema de opciones cerradas "anti-errores", el canvas con cotas en vivo y selección por cabina, el toggle 2D/3D, los precios finales reales con envío incluido, las muestras físicas gratuitas y el acceso humano al equipo de ventas (disponible, pero nunca estorbando el flujo).
