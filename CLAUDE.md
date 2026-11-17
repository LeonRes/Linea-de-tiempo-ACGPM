# CLAUDE.md — Línea de tiempo «De Gales a la Patagonia»

Sitio web trilingüe (español, galés, inglés) con una línea de tiempo interactiva sobre la colonia galesa del Chubut, para la **Asociación Cultural Galesa de Puerto Madryn** (ACGPM). Es el prototipo de la «Fase 1» del plan de trabajo de la Asociación: 10 a 20 eventos, mapa, personas, recursos enlazados a colecciones originales y una actividad educativa.

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
   ├─ site/data/*.json          ← datos que lee la web (commit automático del bot)
   ├─ site/data/sync-report.json← errores y avisos, para site/estado.html
   └─ site/media/drive/…        ← copias de las fotos/audios subidos a Drive
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
  js/config.js            ajustes (idiomas, rutas de datos, mapa, actividad)
  js/i18n.js              idioma actual, textos de interfaz, fechas
  js/data.js              carga de JSON e índices
  js/dom.js               helper el() para crear HTML sin innerHTML, íconos, avisos accesibles
  js/detail.js            ficha de evento/persona en un <dialog>
  js/views/*.js           una vista por archivo: timeline, map, people, activity
  i18n/ui.json            textos fijos de la interfaz en es/cy/en
  data/*.json             GENERADO por scripts/sync-sheet.mjs — no editar a mano
  media/                  imágenes y audios; media/drive/ lo llena la sincronización
  vendor/leaflet/         Leaflet 1.9.4 copiado del paquete npm (sin CDN)
  fonts/                  Source Serif 4 (OFL), alojada localmente
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

## Decisiones y por qué

| Decisión | Motivo |
|---|---|
| HTML + CSS + JS (módulos ES) sin framework ni build | Quien mantenga esto en 5 años tiene que poder abrir un archivo y entenderlo. Cero dependencias que actualizar. GitHub Pages sirve los archivos tal cual. |
| Google Sheet + sincronización a JSON (no lectura en vivo) | La Asociación ya sabe usar planillas. Copiar a JSON da historial en git, validación antes de publicar y una web que no depende de Google. Costo: hasta 1 h de demora. |
| Exportación CSV pública de la planilla (sin API ni claves) | No hay secretos que guardar ni vencer. Requisito: la planilla debe estar compartida como «cualquier persona con el enlace: lector». |
| Las filas con errores no se publican; si ya estaban publicadas, se mantiene la versión anterior | Un error de tipeo nunca borra contenido de la web. Los problemas se listan en estado.html. |
| Los archivos de Drive se copian a `site/media/drive/<id>.<ext>` | Drive no sirve imágenes de forma confiable para incrustar, y así la web no depende de los permisos de Drive. Se descargan una sola vez por id. |
| Enrutado con `#` | GitHub Pages no permite reescribir rutas; con `#/evento/<id>` cada evento tiene enlace propio sin servidor. |
| Idioma en `?lang=` + `localStorage` | Los enlaces compartidos conservan el idioma. Español por defecto; si falta una traducción se muestra el español con la etiqueta «Traducción pendiente» y `lang="es"` para lectores de pantalla. |
| Fechas formateadas a mano (no `Intl`) | El soporte de galés en `Intl` varía entre navegadores. |
| Todo el estilo en variables de `theme.css` | Pedido explícito: mantener la estética actual pero poder cambiarla a futuro tocando un solo archivo. |
| Leaflet + OpenStreetMap, cargado solo al abrir el mapa | Gratis, sin claves. La lista de lugares bajo el mapa es la alternativa accesible. |
| Contenido insertado siempre como texto (`el()` en dom.js, nunca `innerHTML`) | Lo que viene de la planilla no puede inyectar HTML. `safeUrl()` solo deja pasar http(s) y rutas de `media/` o `img/`. |
| Videos: YouTube (dominio youtube-nocookie) y Vimeo, cargados al hacer clic | Privacidad y peso de página. |
| Actividad «ordená los eventos» generada con los eventos publicados | No suma trabajo de carga para la Asociación. |

## Modelo de datos

Los nombres de columna se normalizan (minúsculas, sin acentos: «Año» = `anio`). Los `id` también (`"Fundación de Rawson"` → `fundacion-de-rawson`), así una referencia escrita a mano igual funciona. Los textos traducibles son columnas `<campo>_es`, `_cy`, `_en` y en JSON quedan como `{ es, cy, en }` (solo los que tienen texto).

| Pestaña | Columnas (★ obligatoria) | JSON (`site/data/`) |
|---|---|---|
| `eventos` | id★, año★, mes, dia, año_fin, categoria, lugar, personas (ids separados por coma), publicado (`si`/`no`), titulo_es★/cy/en, resumen_*, texto_* (párrafos separados por línea en blanco) | `events.json`: `{ id, year, month?, day?, endYear?, category?, place?, people[], title, summary, body, resources[] }`, ordenado por fecha |
| `recursos` | evento★, tipo★ (imagen, documento, audio, video, enlace), archivo★ (nombre en `site/media/`, enlace de Drive o URL), titulo_*, descripcion_* (texto alternativo o transcripción), credito, licencia, fuente (URL de la colección original) | dentro de cada evento: `{ type, src, embed?, title?, description?, credit?, license?, source? }`. La primera imagen es la portada. |
| `personas` | id★, nombre★, nacimiento, fallecimiento, rol_*, bio_*, retrato (como `archivo`), retrato_credito, enlace | `people.json` |
| `lugares` | id★, nombre_es★/cy/en, latitud★, longitud★ (acepta coma o punto decimal), descripcion_* | `places.json` |
| `categorias` | id★, nombre_es★/cy/en | `categories.json`; el color sale del orden: 1.ª → `--cat-1`, etc. |

Niveles de problema en `sync-report.json`: `error` (la fila no se publica o se conserva la anterior), `aviso` (se publica, revisar), `traduccion` (falta galés o inglés). Un problema grave (no se puede leer la planilla, falta una columna obligatoria, ningún evento válido) frena la sincronización entera y no escribe nada.

## Cómo agregar eventos

**La Asociación:** en la planilla, una fila nueva en `eventos` y, si tiene fotos o enlaces, filas en `recursos`. Detalle paso a paso en [docs/GUIA-EDITORES.md](docs/GUIA-EDITORES.md). Aparece en la web en ≤ 1 h; los problemas se ven en `estado.html`.

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

Todo está en `site/css/theme.css`: paleta (`--color-*`), colores de categorías (`--cat-1…6`), tipografías (`--font-*` y los `@font-face`), tamaños, radios, sombras y medidas de la línea de tiempo. `styles.css` no debe tener colores literales: si hace falta uno nuevo, se agrega como variable en `theme.css`. La paleta actual sale del logo (rojo #c9141b, celeste, verde) porque todavía no tenemos la línea de tiempo impresa de la Asociación que se pidió tomar como referencia.

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

- **Contenido de muestra:** 4 eventos, 3 personas y 3 lugares para mostrar el formato. Las traducciones al galés las redactó una IA y **necesitan revisión de un hablante nativo** antes de mostrarse al público; los datos históricos también deben verificarse (por ejemplo, el número de pasajeros del Mimosa varía según la fuente).
- Las imágenes de muestra vienen de Wikimedia Commons (dominio público, con crédito y enlace a la fuente en cada recurso).
- No se achican las imágenes automáticamente: la sincronización avisa si una pesa más de 1,5 MB.
- El estilo provisorio se basa en el logo; falta adaptarlo a la línea de tiempo impresa de la Asociación cuando esté disponible.
- Fuera de alcance por ahora (previsto en el plan de la Asociación para fases siguientes): más actividades educativas, búsqueda, historias orales.

## Convenciones para trabajar en este repo

- Español en código, comentarios, mensajes y commits (es el idioma de quienes mantienen el sitio). Los mensajes que ve la Asociación deben ser claros para alguien sin conocimientos técnicos.
- Sin dependencias nuevas salvo que sea imprescindible; si se agrega una librería de navegador, copiarla a `site/vendor/` con su licencia.
- Antes de subir cambios: `npm test` y revisar el sitio en `npm run servir` en escritorio y en un ancho de celular (390 px), en los tres idiomas.
- Un cambio en las columnas de la planilla requiere actualizar a la vez: la planilla, `scripts/lib/build.mjs` (`TABS` y la lectura), `scripts/plantilla/*.csv`, la pestaña LEEME de la planilla, este archivo y la guía de editores.
