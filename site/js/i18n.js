// Idiomas: textos de la interfaz (i18n/ui.json) y textos del contenido ({ es, cy, en }).

import { LANGS, DEFAULT_LANG, UI_STRINGS_FILE } from './config.js';

let strings = {};
let current = DEFAULT_LANG;

export async function loadStrings() {
  const response = await fetch(UI_STRINGS_FILE);
  if (!response.ok) throw new Error(`No se pudo leer ${UI_STRINGS_FILE}`);
  strings = await response.json();
}

export const getLang = () => current;

// Orden de preferencia: ?lang= en la dirección, lo que la persona eligió antes, el idioma del navegador.
export function detectLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem('lang');
    if (LANGS.includes(saved)) return saved;
  } catch { /* almacenamiento bloqueado: se sigue sin recordar */ }
  for (const tag of navigator.languages ?? []) {
    const code = tag.toLowerCase().split('-')[0];
    if (LANGS.includes(code)) return code;
  }
  return DEFAULT_LANG;
}

export function setLang(lang, { remember = false } = {}) {
  current = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  document.documentElement.lang = current;
  if (remember) {
    try { localStorage.setItem('lang', current); } catch { /* idem */ }
  }
}

// Texto de la interfaz. Las variables van entre llaves: t('activity.result', { n: 3, total: 4 }).
export function t(key, vars = {}) {
  const entry = strings[key];
  const text = entry?.[current] ?? entry?.[DEFAULT_LANG] ?? key;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

// Texto del contenido. Si falta la traducción devuelve el español y avisa con `pending`.
export function tr(field) {
  if (!field) return { text: '', lang: current, pending: false };
  if (field[current]) return { text: field[current], lang: current, pending: false };
  if (field[DEFAULT_LANG]) return { text: field[DEFAULT_LANG], lang: DEFAULT_LANG, pending: current !== DEFAULT_LANG };
  const other = LANGS.find((lang) => field[lang]);
  return other ? { text: field[other], lang: other, pending: true } : { text: '', lang: current, pending: false };
}

export const trText = (field) => tr(field).text;

// Fechas escritas a mano (no con Intl) para que el galés se vea igual en todos los navegadores.
export function formatDate({ year, month, day, endYear }) {
  if (endYear) return `${year}–${endYear}`;
  if (!month) return String(year);
  const monthName = strings.months?.[current]?.[month - 1] ?? String(month);
  const text = t(day ? 'date.full' : 'date.month', { d: day, month: monthName, y: year });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Fecha para el atributo datetime de <time>.
export function isoDate({ year, month, day }) {
  const pad = (n) => String(n).padStart(2, '0');
  return [String(year).padStart(4, '0'), month && pad(month), month && day && pad(day)].filter(Boolean).join('-');
}

// Completa los textos fijos del HTML: data-i18n (contenido) y data-i18n-attr="atributo:clave".
export function applyStaticTexts(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map((part) => part.trim());
      if (attribute && key) node.setAttribute(attribute, t(key));
    }
  }
}
