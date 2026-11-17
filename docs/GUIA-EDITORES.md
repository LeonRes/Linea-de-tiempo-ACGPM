# Guía para cargar contenido

Esta guía es para quienes cargan y corrigen el contenido de la línea de tiempo «De Gales a la Patagonia». No hace falta saber programar: todo se hace desde una planilla de Google.

- **Planilla:** https://docs.google.com/spreadsheets/d/1qWxX6QHwLKEnbV8p8aCVxe1P1WOr_QzUJYPcln8X-yA/edit
- **Sitio web:** https://leonres.github.io/Linea-de-tiempo-ACGPM/
- **Página de estado** (para ver si algo quedó mal cargado): https://leonres.github.io/Linea-de-tiempo-ACGPM/estado.html

## Cómo funciona

La web reproduce la línea de tiempo impresa de la Asociación: cada evento es un círculo dentro de una **franja** (Gales, Argentina, la colonia galesa, Chubut y Puerto Madryn), ordenado por fecha. Los eventos que tienen foto se ven como una «cápsula» blanca con la foto arriba. En el celular se ven como una lista por décadas.

1. Ustedes escriben en la planilla.
2. Una vez por hora, el sitio lee la planilla, revisa que todo esté bien y se actualiza solo.
3. Si una fila tiene un problema, esa fila no se publica (o queda como estaba antes) y el motivo aparece en la página de estado. El resto del sitio se actualiza igual.

No hay forma de «romper» la web desde la planilla: en el peor caso, un cambio no aparece hasta que se corrige.

## Reglas básicas

- **No cambien los nombres de la primera fila** de cada pestaña ni borren pestañas.
- **Una fila = una cosa:** un evento, una foto, una persona o un lugar.
- **El español es obligatorio.** Si falta el galés o el inglés, la web muestra el texto en español con la etiqueta «Traducción pendiente». Se puede completar después.
- **Los `id`** son nombres cortos para identificar cada fila: en minúsculas, sin espacios, con guiones. Por ejemplo `zarpa-el-mimosa`. No se pueden repetir. Una vez publicado un evento, conviene no cambiarle el id, porque es parte de su dirección web y los enlaces compartidos dejarían de funcionar.

Los colores de los encabezados ayudan: celeste = español, verde = galés, rojo = inglés.

## Agregar un evento

En la pestaña **eventos**, en la primera fila vacía:

| Columna | Qué poner | Ejemplo |
|---|---|---|
| id | Nombre corto, único | `llegada-a-trelew` |
| año | Obligatorio, cuatro cifras | `1886` |
| mes, dia | Opcionales, en números | `7`, `28` |
| año_fin | Solo si el evento dura varios años | `1863` |
| franja | En qué franja va. Elegir de la lista | `colonia-galesa` |
| color | Opcional. Para que el círculo tenga otro color que el de su franja, como en el afiche: `verde`, `azul`, `bordo`, `naranja`, `gris` o `blanco` | `naranja` |
| lugar | Elegir de la lista | `puerto-madryn` |
| personas | ids de la pestaña personas, separados por comas | `lewis-jones, michael-d-jones` |
| publicado | `si` para mostrarlo; `no` para dejarlo guardado como borrador | `si` |
| titulo_es / _cy / _en | Título corto | |
| resumen_es / _cy / _en | Una o dos oraciones. Se ven al abrir el evento y en la vista de lista. | |
| texto_es / _cy / _en | El texto completo que se lee al abrir el evento. Para separar párrafos, dejar una línea en blanco. | |

> Para escribir varias líneas dentro de una celda: **Ctrl + Enter** (en Mac, **⌘ + Enter**).

El orden de las filas no importa: la web ordena los eventos por fecha.

## Agregar fotos, documentos, audios, videos y enlaces

Cada recurso es una fila en la pestaña **recursos**. Un evento puede tener varios. **La primera imagen de un evento es la que se ve en su cápsula** de la línea de tiempo.

| Columna | Qué poner |
|---|---|
| evento | El id del evento (se elige de la lista) |
| tipo | `imagen`, `documento`, `audio`, `video` o `enlace` |
| archivo | Ver abajo |
| titulo_* | El pie de foto, o el texto del enlace |
| descripcion_* | **Imagen:** qué se ve (lo escuchan las personas ciegas). **Audio o video:** la transcripción. **Enlace:** una aclaración opcional. |
| credito | Autor o institución (por ejemplo «Museo del Desembarco») |
| licencia | Permiso de uso (por ejemplo «Dominio público» o «Cedida por la familia Jones») |
| fuente | La dirección web de la colección original, si existe |

### Qué poner en «archivo»

- **Una foto, audio o documento propio:**
  1. Subirlo a Google Drive.
  2. Clic derecho → **Compartir** → en «Acceso general» elegir **Cualquier persona que tenga el enlace** (lector).
  3. **Copiar vínculo** y pegarlo en la columna `archivo`.
  El sitio guarda su propia copia del archivo. Si después quieren cambiar la foto, suban un archivo nuevo y peguen el enlace nuevo (cambiar el archivo dentro de Drive no se detecta).
- **Un video:** la dirección de YouTube o Vimeo, por ejemplo `https://www.youtube.com/watch?v=…`.
- **Un enlace a otra colección** (Biblioteca Nacional de Gales, People's Collection Wales, un museo…): la dirección completa, empezando con `https://`.

Fotos: lo ideal es que pesen menos de 1,5 MB (unos 1600 píxeles de ancho). Si pesan más, la página de estado avisa.

**Derechos:** carguen solo material propio, de dominio público, o con permiso de quien lo tiene. Siempre completen el crédito.

## Agregar una persona

Pestaña **personas**: `id` y `nombre` son obligatorios. `nacimiento` y `fallecimiento` son años. `rol` es una frase corta («Explorador y dirigente de la colonia»); `bio` es la biografía. `retrato` funciona igual que `archivo` en recursos. `enlace` es una página con más información.

Para que la persona aparezca en un evento, pongan su id en la columna `personas` del evento.

## Agregar un lugar

Pestaña **lugares**: `id`, `nombre_es`, `latitud` y `longitud` son obligatorios.

Para obtener las coordenadas: en Google Maps, clic derecho sobre el lugar y clic en los números que aparecen arriba de todo (quedan copiados, por ejemplo `-42.7692, -65.0385`). El primer número es la latitud y el segundo la longitud. En la Patagonia los dos son negativos.

## Revisar si algo quedó mal

Abran la **página de estado**. Ahí aparecen:

- **Errores:** filas que no se publicaron. Dice en qué pestaña y fila está el problema y qué falta.
- **Avisos:** cosas que se publicaron pero conviene mejorar (por ejemplo, una foto sin descripción o muy pesada).
- **Traducciones pendientes:** textos que solo están en español.

## Preguntas frecuentes

**Cargué algo y no aparece.** Esperen una hora y recarguen la página (en el celular, a veces hace falta cerrar y volver a abrir el navegador). Si sigue sin aparecer, miren la página de estado. Revisen también que la columna `publicado` no diga `no`.

**¿Puedo borrar un evento?** Sí: borren la fila (y las de sus recursos). Si prefieren ocultarlo sin perderlo, pongan `no` en `publicado`.

**¿Puedo agregar una franja nueva?** Sí, en la pestaña **franjas** (por ejemplo «Trelew» o «Mundo»). Las franjas aparecen en la web en el orden de las filas, y el color de fondo se asigna según ese orden. En la columna `bandera` va la imagen que se ve a la izquierda, igual que una foto.

**¿Cómo elijo el color de un círculo?** Con la columna `color` del evento. Si la dejan vacía, el círculo toma el color de su franja (verde en Gales y en la colonia galesa, azul en Argentina, blanco en Chubut).

**¿Puedo compartir el enlace de un evento?** Sí: al abrir un evento, el botón «Copiar enlace» copia su dirección, en el idioma que se está viendo.

**Algo no funciona y no sé por qué.** Escriban a quien mantiene el sitio con la dirección de la página de estado y una captura de pantalla.
