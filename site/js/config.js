// Ajustes generales del sitio. Lo visual (colores, tipografías) está en css/theme.css.

export const LANGS = ['es', 'cy', 'en'];
export const DEFAULT_LANG = 'es';

// Archivos de datos. Los genera scripts/sync-sheet.mjs a partir de la planilla: no editarlos a mano.
export const DATA_FILES = {
  events: 'data/events.json',
  people: 'data/people.json',
  places: 'data/places.json',
  lanes: 'data/lanes.json',
};
export const UI_STRINGS_FILE = 'i18n/ui.json';

// Mapa: mosaicos de OpenStreetMap (gratuitos, sin clave; exigen mostrar la atribución).
export const MAP = {
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 18,
  placeZoom: 10,
};

// Línea de tiempo: debajo de este ancho de pantalla se muestra siempre como lista.
export const TIMELINE = { listQuery: '(max-width: 47.99rem)' };

// Cantidad de eventos que se usan en la actividad «ordená los eventos».
export const ACTIVITY = { minEvents: 3, maxEvents: 5 };

// Solo se incrustan videos de estos sitios.
export const VIDEO_EMBED_PREFIXES = ['https://www.youtube-nocookie.com/embed/', 'https://player.vimeo.com/video/'];
