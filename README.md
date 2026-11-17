# De Gales a la Patagonia — línea de tiempo

Línea de tiempo interactiva y trilingüe (español · Cymraeg · English) sobre la historia de la colonia galesa del Chubut, para la **Asociación Cultural Galesa de Puerto Madryn**.

- **Sitio:** https://leonres.github.io/Linea-de-tiempo-ACGPM/
- **Contenido:** se carga en una [planilla de Google](https://docs.google.com/spreadsheets/d/1qWxX6QHwLKEnbV8p8aCVxe1P1WOr_QzUJYPcln8X-yA/edit) y el sitio se actualiza solo cada hora.
- **Guía para quienes cargan contenido:** [docs/GUIA-EDITORES.md](docs/GUIA-EDITORES.md)
- **Arquitectura, decisiones y mantenimiento:** [CLAUDE.md](CLAUDE.md)

El diseño reproduce la línea de tiempo impresa de la Asociación: franjas con banderas para Gales, Argentina, la colonia galesa y Chubut, barra de décadas y eventos en círculos de color. Incluye fichas de eventos con fotos, audio, video y enlaces a las colecciones originales, mapa Gales–Patagonia, fichas de personas y una actividad educativa.

## Para desarrollar

Requiere Node 20 o posterior (sin dependencias que instalar) y Python 3 para el servidor local.

```bash
npm run servir      # http://localhost:8000
```

```bash
npm test
```

```bash
npm run revisar     # revisa la planilla sin escribir nada
```

## Créditos

- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), con [Leaflet](https://leafletjs.com/) (BSD-2).
- Tipografía: Oswald (SIL Open Font License).
- Diseño, colores y banderas: tomados de la línea de tiempo impresa de la Asociación Cultural Galesa de Puerto Madryn.
- Imágenes de muestra: Wikimedia Commons, dominio público; el crédito de cada una figura en su ficha.
