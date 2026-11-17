// Ayudas para armar el HTML desde JavaScript sin usar innerHTML con contenido de la planilla
// (todo el texto entra como texto, nunca como código).

import { t, tr, getLang } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// el('a', { class: 'x', href: '#/' }, 'texto', otroNodo)
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (name === 'class') node.className = value;
    else if (name === 'dataset') Object.assign(node.dataset, value);
    else if (name === 'style') node.setAttribute('style', value);
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

// Reemplaza el contenido de un nodo ignorando los valores vacíos o false que dejan
// las condiciones (replaceChildren los convertiría en el texto «false»).
export function setChildren(node, ...children) {
  node.replaceChildren(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
}

// Texto traducible. Si se muestra en otro idioma (falta la traducción) lo marca con `lang`
// para los lectores de pantalla y agrega la etiqueta «traducción pendiente».
export function trEl(tag, attrs, field, { badge = true } = {}) {
  const { text, lang, pending } = tr(field);
  if (!text) return null;
  const node = el(tag, attrs, text);
  if (lang !== getLang()) node.lang = lang;
  if (pending && badge) node.append(' ', pendingBadge());
  return node;
}

export function pendingBadge() {
  return el('span', { class: 'badge-pending', lang: getLang() }, t('pending'));
}

// Texto largo: cada línea en blanco separa un párrafo.
export function paragraphs(field, attrs = {}) {
  const { text, lang, pending } = tr(field);
  if (!text) return null;
  const box = el('div', attrs);
  if (lang !== getLang()) box.lang = lang;
  if (pending) box.append(el('p', {}, pendingBadge()));
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.trim();
    if (lines) box.append(el('p', {}, lines));
  }
  return box;
}

const ICONS = {
  pin: 'M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  arrowRight: 'M5 12h13m-5-6 6 6-6 6',
  arrowLeft: 'M19 12H6m5-6-6 6 6 6',
  arrowUp: 'M12 19V6m-6 5 6-6 6 6',
  arrowDown: 'M12 5v13m-6-5 6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  external: 'M14 5h5v5m0-5-8 8M11 7H6v11h11v-5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  document: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5m-5 4h5',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
};

export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon icon-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

// Solo se enlazan direcciones web normales o archivos del propio sitio.
export function safeUrl(url) {
  const value = String(url ?? '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(media|img)\//.test(value) && !value.includes('..')) return value;
  return null;
}

export const isExternal = (url) => /^https?:\/\//i.test(url ?? '');

// Enlace que se abre en otra pestaña, con aviso para lectores de pantalla.
export function externalLink(url, attrs, ...children) {
  return el('a', { ...attrs, href: url, target: '_blank', rel: 'noopener noreferrer' },
    ...children, ' ', icon('external'), el('span', { class: 'visually-hidden' }, ` ${t('media.newTab')}`));
}

// Avisa un mensaje a los lectores de pantalla sin mover el foco.
export function announce(message) {
  const region = document.getElementById('avisos');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}
