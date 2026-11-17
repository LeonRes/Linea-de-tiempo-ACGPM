# CLAUDE.md — Línea de tiempo «De Gales a la Patagonia»

Sitio web trilingüe (español, galés, inglés) con una línea de tiempo interactiva sobre la colonia galesa del Chubut, para la **Asociación Cultural Galesa de Puerto Madryn** (ACGPM). Es el prototipo de la «Fase 1» del plan de trabajo de la Asociación: 10 a 20 eventos, mapa, personas, recursos enlazados a colecciones originales y una actividad educativa.

El diseño reproduce la **línea de tiempo impresa que la Asociación usa hoy** (un afiche horizontal): franjas por ámbito (Gales, Argentina, la colonia galesa, Chubut y Puerto Madryn) con su bandera, barra de décadas gris oscura arriba y abajo, eventos en círculos de color con letra condensada y «cápsulas» blancas para los eventos con foto.

- Sitio publicado: https://leonres.github.io/Linea-de-tiempo-ACGPM/
- Planilla con el contenido: https://docs.google.com/spreadsheets/d/1qWxX6QHwLKEnbV8p8aCVxe1P1WOr_QzUJYPcln8X-yA/edit
- Estado de la última sincronización: https://leonres.github.io/Linea-de-tiempo-ACGPM/estado.html
- Guía para quienes editan (sin jerga técnica): [docs/GUIA-EDITORES.md](docs/GUIA-EDITORES.md)

## Arquitectura

```
Google Sheet (la Asociación edita acá)
   │  cada hora, GitHub Actions (.github/workflows/publicar.yml)
   ▼
scripts/sync-sheet.mjs ── lee las 5 pestañas como CSV, valida, descarga los archivos de Drive
   │
   ├─ site/data/*.json           ← datos que lee la web (commit automático del bot)
   ├─ site/data/sync-report.json ← errores y avisos, para site/estado.html
   └─ site/media/drive/…         ← copias de las fotos/audios subidos a Drive
   ▼
GitHub Pages publica la carpeta site/ tal cual (sin paso de compilación)
```

La web **nunca** lee la planilla directamente: solo lee `site/data/*.json`. Si Google falla o alguien rompe la planilla, la web sigue mostrando la última versión válida.

### Estructura

```
site/                     lo que se publica
  index.html              única página de la web (las vistas se arman con JS)
  estado.html             informe de la sincronización para editores (independiente, JS mínimo)
  css/theme.css           TODOS los colores, tipografías y medidas (variables CSS)
  css/styles.css          el resto del diseño; solo usa variables de theme.css
  js/main.js              arranque y enrutador (#/, #/mapa, #/personas, #/actividad, #/evento/<id>, #/persona/<id>)
  js/config.js            ajustes (idiomas, rutas de datos, mapa, ancho para la vista lista, actividad)
  js/i18n.js              idioma actual, textos de interfaz, fechas
  js/data.js              carga de JSON, índices y clases de color por franja
  js/dom.js               helper el() para crear HTML sin innerHTML, íconos, avisos accesibles
  js/detail.js            ficha de evento/persona en un <dialog>
  js/views/timeline.js    línea de tiempo: vista «línea» (franjas) y vista «lista» (por décadas)
  js/views/*.js           mapa, personas, actividad
  i18n/ui.json            textos fijos de la interfaz en es/cy/en
  data/*.json             GENERADO por scripts/sync-sheet.mjs — no editar a mano
  media/                  imágenes y audios; media/franjas/ = banderas; media/drive/ lo llena la sincronización
  vendor/leaflet/         Leaflet 1.9.4 copiado del paquete npm (sin CDN)
  fonts/                  Oswald (OFL), alojada localmente
scripts/
  sync-sheet.mjs          planilla → site/data (red, disco, informe)
  lib/build.mjs           validación y transformación (función pura, la que se prueba)
  lib/csv.mjs, media.mjs  lector CSV; clasificación de archivos/enlaces (Drive, YouTube…)
  sheet.config.json       ID de la planilla y número (gid) de cada pestaña
  plantilla/*.csv         copia local de las pestañas con los datos de muestra (pruebas y modo sin internet)
  test/build.test.mjs     pruebas (node:test, sin dependencias)
.github/workflows/
  publicar.yml            main: sincroniza cada hora, guarda cambios y despliega en Pages
  pruebas.yml             otras ramas y PRs: npm test + revisión de la planilla sin publicar
```

## La línea de tiempo

- **Vista «línea»** (pantallas de 768 px o más): una grilla CSS. Columnas = décadas (antes de 1800, siglos, como en el afiche), desde la primera hasta la última con eventos, sin saltear décadas vacías; filas = franjas. En cada celda los eventos se apilan de a dos y siguen hacia la derecha (`grid-auto-flow: column dense`); los eventos con foto son cápsulas que ocupan las dos filas. La columna de banderas queda fija a la izquierda (`position: sticky`) y la barra de herramientas fija debajo del menú. Se recorre con las flechas, arrastrando con el mouse, con el trackpad o con el teclado.
- **Vista «lista»**: los mismos eventos por décadas, con el color de su franja. Es la única en celulares y una opción en escritorio (se recuerda en `localStorage`).
- Los eventos se ordenan por fecha. Las franjas se muestran en el orden de la pestaña «franjas»; el filtro por franja muestra solo esa fila.
- Accesibilidad: cada franja es una `<section>` con su nombre como `<h2>`; cada evento es un enlace con año y título completos (el recorte del texto es solo visual); orden de tabulación: franja por franja, en orden cronológico.

## Decisiones y por qué

| Decisión | Motivo |
|---|---|
| HTML + CSS + JS (módulos ES) sin framework ni build | Quien mantenga esto en 5 años tiene que poder abrir un archivo y entenderlo. Cero dependencias que actualizar. GitHub Pages sirve los archivos tal cual. |
| Diseño copiado del afiche de la Asociación | Pedido explícito: mantener el estilo de la línea de tiempo actual. Colores medidos del afiche; banderas recortadas de su columna de banderas; Oswald como letra condensada equivalente. |
| Franjas horizontales en escritorio, lista en celular | Es la forma del afiche. En un celular cuatro franjas a lo ancho no se pueden leer, así que ahí se usa la lista con el mismo lenguaje visual. |
| Todo el estilo en variables de `theme.css` | Pedido explícito: que el estilo se pueda actualizar a futuro tocando un solo archivo. `styles.css` no tiene colores literales. |
| Color del círculo opcional por evento (`color` en la planilla) | En el afiche el color también distingue tipos de hecho dentro de una franja (p. ej. naranja = inmigración). Por defecto, cada franja tiene su color. |
| Google Sheet + sincronización a JSON (no lectura en vivo) | La Asociación ya sabe usar planillas. Copiar a JSON da historial en git, validación antes de publicar y una web que no depende de Google. Costo: hasta 1 h de demora. |
| Exportación CSV pública de la planilla (sin API ni claves) | No hay secretos que guardar ni vencer. Requisito: la planilla debe estar compartida como «cualquier persona con el enlace: lector». |
| Las filas con errores no se publican; si ya estaban publicadas, se mantiene la versión anterior | Un error de tipeo nunca borra contenido de la web. Los problemas se listan en estado.html. |
| Los archivos de Drive se copian a `site/media/drive/<id>.<ext>` | Drive no sirve imágenes de forma confiable para incrustar, y así la web no depende de los permisos de Drive. Se descargan una sola vez por id. |
| Enrutado con `#` | GitHub Pages no permite reescribir rutas; con `#/evento/<id>` cada evento tiene enlace propio sin servidor. |
| Idioma en `?lang=` + `localStorage` | Los enlaces compartidos conservan el idioma. Español por defecto; si falta una traducción se muestra el español con la etiqueta «Traducción pendiente» y `lang="es"` para lectores de pantalla. |
| Fechas formateadas a mano (no `Intl`) | El soporte de galés en `Intl` varía entre navegadores. |
| Leaflet + OpenStreetMap, cargado solo al abrir el mapa | Gratis, sin claves. La lista de lugares bajo el mapa es la alternativa accesible. |
| Contenido insertado siempre como texto (`el()` en dom.js, nunca `innerHTML`) | Lo que viene de la planilla no puede inyectar HTML. `safeUrl()` solo deja pasar http(s) y rutas de `media/` o `img/`. |
| Videos: YouTube (dominio youtube-nocookie) y Vimeo, cargados al hacer clic | Privacidad y peso de página. |
| Actividad «ordená los eventos» generada con los eventos publicados | No suma trabajo de carga para la Asociación. |
| Texto naranja oscuro sobre círculos naranjas | En el afiche es blanco, pero el blanco sobre ese naranja no llega al contraste mínimo (2,3:1). Todos los demás pares de colores cumplen WCAG AA. |

## Modelo de datos

Los nombres de columna se normalizan (minúsculas, sin acentos: «Año» = `anio`). Los `id` también (`"Fundación de Rawson"` → `fundacion-de-rawson`), así una referencia escrita a mano igual funciona. Los textos traducibles son columnas `<campo>_es`, `_cy`, `_en` y en JSON quedan como `{ es, cy, en }` (solo los que tienen texto).

| Pestaña | Columnas (★ obligatoria) | JSON (`site/data/`) |
|---|---|---|
| `eventos` | id★, año★, mes, dia, año_fin, franja, color (verde, azul, bordo, naranja, gris, blanco), lugar, personas (ids separados por coma), publicado (`si`/`no`), titulo_es★/cy/en, resumen_*, texto_* (párrafos separados por línea en blanco) | `events.json`: `{ id, year, month?, day?, endYear?, lane, color?, place?, people[], title, summary, body, resources[] }`, ordenado por fecha. Sin franja válida → primera franja + aviso. |
| `recursos` | evento★, tipo★ (imagen, documento, audio, video, enlace), archivo★ (nombre en `site/media/`, enlace de Drive o URL), titulo_*, descripcion_* (texto alternativo o transcripción), credito, licencia, fuente (URL de la colección original) | dentro de cada evento: `{ type, src, embed?, title?, description?, credit?, license?, source? }`. La primera imagen es la foto de la cápsula. |
| `personas` | id★, nombre★, nacimiento, fallecimiento, rol_*, bio_*, retrato (como `archivo`), retrato_credito, enlace | `people.json` |
| `lugares` | id★, nombre_es★/cy/en, latitud★, longitud★ (acepta coma o punto decimal), descripcion_* | `places.json` |
| `franjas` | id★, nombre_es★/cy/en, bandera (como `archivo`) | `lanes.json`: `{ id, name, flag? }`; los colores salen del orden: 1.ª → `--lane-1-*`, etc. |

Niveles de problema en `sync-report.json`: `error` (la fila no se publica o se conserva la anterior), `aviso` (se publica, revisar), `traduccion` (falta galés o inglés). Un problema grave (no se puede leer la planilla, falta una columna obligatoria, ningún evento válido) frena la sincronización entera y no escribe nada.

## Cómo agregar eventos

**La Asociación:** en la planilla, una fila nueva en `eventos` (eligiendo su franja) y, si tiene fotos o enlaces, filas en `recursos`. Detalle paso a paso en [docs/GUIA-EDITORES.md](docs/GUIA-EDITORES.md). Aparece en la web en ≤ 1 h; los problemas se ven en `estado.html`.

**Para publicar ya:** GitHub → Actions → «Publicar sitio» → Run workflow (requiere permiso de escritura en el repo).

**Desarrollo local:**

```bash
npm run revisar            # lee la planilla real y muestra problemas, sin escribir nada
npm run sincronizar        # lee la planilla y actualiza site/data (lo mismo que hace la Action)
npm run probar-plantilla   # usa scripts/plantilla/*.csv en lugar de la planilla (sin internet)
npm run servir             # http://localhost:8000
npm test                   # pruebas del validador
```

No editar `site/data/*.json` a mano: la próxima sincronización lo sobrescribe con lo que diga la planilla.

## Cómo cambiar el estilo

Todo está en `site/css/theme.css`:

- `--color-*`: base (gris oscuro del afiche, fondo, texto, enlaces, rojo del logo).
- `--lane-N-bg` y `--lane-N-bubble*`: fondo de cada franja y color por defecto de sus círculos, según el orden de la pestaña «franjas».
- `--bubble-<color>-bg/fg/border`: los colores que se pueden elegir en la columna `color`. Para agregar uno nuevo: definirlo acá, agregar su clase `.bubble--<color>` en `styles.css` y su nombre en `BUBBLE_COLORS` de `scripts/lib/build.mjs` (y en la lista desplegable de la planilla).
- `--font-*` y los `@font-face`: tipografías. `--bubble-size`, `--lane-label-width`, `--period-min-width`: medidas de la línea.

Las banderas son imágenes en `site/media/franjas/` y se pueden cambiar desde la columna `bandera` de la planilla.

## Textos de la interfaz e idiomas

- Textos fijos (menú, botones, avisos): `site/i18n/ui.json`, con variables entre llaves, como `{n}`. Los del HTML usan `data-i18n="clave"` o `data-i18n-attr="atributo: clave"`.
- Agregar un idioma: sumarlo a `LANGS` en `site/js/config.js` y `scripts/lib/build.mjs`, agregar sus textos en `ui.json` (incluido `months`), su enlace en el selector de `index.html` y las columnas `_xx` en la planilla.

## Mantenimiento

- **GitHub desactiva las tareas programadas tras 60 días sin actividad** en el repo (el bot solo hace commits cuando cambia la planilla). Llega un correo; se reactiva en Actions → «Publicar sitio» → Enable workflow.
- Si la sincronización falla, la ejecución queda en rojo y GitHub avisa por correo a quien configuró el flujo. La web no cambia.
- **Si se copia la planilla** (en vez de transferir su propiedad) cambia el ID: actualizar `scripts/sheet.config.json`. Los `gid` (1001–1005) se conservan al copiar el archivo entero.
- La planilla debe seguir compartida como «Cualquier persona que tenga el enlace: lector».
- Las copias de Drive se identifican por el id del archivo: para reemplazar una foto, subir un archivo nuevo y pegar su enlace (editar el archivo en Drive no se detecta). Las copias que ya no se usan quedan en `site/media/drive/` y se pueden borrar a mano.
- Pages: Settings → Pages → Source = «GitHub Actions» (ya configurado).

## Limitaciones conocidas y pendientes

- **Contenido de muestra:** 12 eventos (3 por franja), 3 personas y 5 lugares, tomados del afiche de la Asociación para el período 1848–1876. Las traducciones al galés las redactó una IA y **necesitan revisión de un hablante nativo** antes de mostrarse al público. Datos para verificar con la Asociación: el embarque el 25 de mayo y la partida el 28 de mayo de 1865, el número de pasajeros del Mimosa (varía según la fuente) y el tratado «Chegüelcho» de 1865.
- Las imágenes de muestra vienen de Wikimedia Commons (dominio público, con crédito y enlace a la fuente en cada recurso). Las banderas están recortadas del afiche de la Asociación.
- Del afiche todavía no se reproducen la franja de infraestructura de Puerto Madryn (acueducto, gas, puerto, aeropuerto), los datos de población en la barra inferior, la fila de presidentes argentinos ni las fotos de fondo de cada franja.
- No se achican las imágenes automáticamente: la sincronización avisa si una pesa más de 1,5 MB.
- Fuera de alcance por ahora (previsto en el plan de la Asociación para fases siguientes): más actividades educativas, búsqueda, historias orales.

## Convenciones para trabajar en este repo

- Español en código, comentarios, mensajes y commits (es el idioma de quienes mantienen el sitio). Los mensajes que ve la Asociación deben ser claros para alguien sin conocimientos técnicos.
- Sin dependencias nuevas salvo que sea imprescindible; si se agrega una librería de navegador, copiarla a `site/vendor/` con su licencia.
- Antes de subir cambios: `npm test` y revisar el sitio en `npm run servir` en escritorio (vista línea y lista) y en un ancho de celular (390 px), en los tres idiomas.
- Un cambio en las columnas de la planilla requiere actualizar a la vez: la planilla, `scripts/lib/build.mjs` (`TABS` y la lectura), `scripts/plantilla/*.csv`, la pestaña LEEME de la planilla, este archivo y la guía de editores.
