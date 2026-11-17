// Ficha de un evento o de una persona. Se muestra en una ventana (<dialog>) sobre la vista actual.

import { data, laneOf, placeOf, peopleOf, eventsOf, colorClasses } from './data.js';
import { t, tr, trText, formatDate, isoDate, getLang } from './i18n.js';
import { el, trEl, paragraphs, icon, safeUrl, isExternal, externalLink, announce } from './dom.js';
import { VIDEO_EMBED_PREFIXES } from './config.js';

const dialog = () => document.getElementById('detalle');

let onClose = () => {};
let closedByRouter = false;

// `handleClose` se llama cuando la persona cierra la ficha (botón, tecla Escape o clic afuera).
export function initDetail(handleClose) {
  onClose = handleClose;
  const node = dialog();
  node.addEventListener('close', () => {
    node.replaceChildren();
    if (!closedByRouter) onClose();
    closedByRouter = false;
  });
  // Clic fuera de la ficha (sobre el fondo oscuro): cerrar.
  node.addEventListener('click', (event) => { if (event.target === node) node.close(); });
}

export const isDetailOpen = () => dialog().open;

// La usa el enrutador cuando la dirección cambió a otra vista: cierra sin volver a navegar.
export function closeDetail() {
  if (!dialog().open) return;
  closedByRouter = true;
  dialog().close();
}

function show(content, labelId) {
  const node = dialog();
  node.setAttribute('aria-labelledby', labelId);
  node.replaceChildren(
    el('div', { class: 'detail-bar' },
      el('button', { type: 'button', class: 'icon-button', onclick: copyLink }, icon('link'), el('span', {}, t('dialog.copyLink'))),
      el('button', { type: 'button', class: 'icon-button detail-close', 'aria-label': t('dialog.close'), onclick: () => node.close() }, icon('close')),
    ),
    content,
  );
  if (!node.open) node.showModal();
  node.scrollTop = 0;
  node.querySelector('h2')?.focus({ preventScroll: true });
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    announce(t('dialog.copied'));
    const label = dialog().querySelector('.detail-bar .icon-button span');
    if (label) {
      label.textContent = t('dialog.copied');
      setTimeout(() => { label.textContent = t('dialog.copyLink'); }, 2500);
    }
  } catch { /* sin permiso para el portapapeles: la dirección sigue en la barra del navegador */ }
}

// ---------------------------------------------------------------------------
// Evento

export function showEvent(event) {
  const lane = laneOf(event);
  const flag = safeUrl(lane?.flag);
  const place = placeOf(event);
  const people = peopleOf(event);
  const resources = event.resources ?? [];
  const images = resources.filter((r) => r.type === 'image' && safeUrl(r.src));
  const players = resources.filter((r) => r.type === 'audio' || r.type === 'video');
  const links = resources.filter((r) => (r.type === 'link' || r.type === 'document') && safeUrl(r.src));

  const index = data.events.indexOf(event);
  const previous = data.events[index - 1];
  const next = data.events[index + 1];

  show(el('article', { class: `detail-content ${colorClasses(event)}` },
    el('header', { class: 'detail-header' },
      el('p', { class: 'detail-meta' },
        el('time', { class: 'detail-date', datetime: isoDate(event) }, formatDate(event)),
        lane && el('span', { class: 'detail-lane' }, flag && el('img', { src: flag, alt: '' }), trText(lane.name)),
      ),
      trEl('h2', { id: 'detalle-titulo', tabindex: '-1' }, event.title),
      place && el('p', { class: 'detail-place' },
        el('a', { href: `#/mapa/${place.id}` }, icon('pin'), trText(place.name), el('span', { class: 'detail-place-hint' }, ` · ${t('event.seeOnMap')}`)),
      ),
    ),
    images[0] && figure(images[0], 'detail-figure detail-figure--cover'),
    trEl('p', { class: 'detail-summary' }, event.summary, { badge: false }),
    paragraphs(event.body, { class: 'detail-text' }),
    images.length > 1 && el('div', { class: 'detail-gallery' }, images.slice(1).map((image) => figure(image, 'detail-figure'))),
    players.length > 0 && el('section', { class: 'detail-section' },
      el('h3', {}, t('event.media')),
      players.map(player),
    ),
    people.length > 0 && el('section', { class: 'detail-section' },
      el('h3', {}, t('event.people')),
      el('ul', { class: 'people-chips' }, people.map((person) => el('li', {},
        el('a', { class: 'person-chip', href: `#/persona/${person.id}` }, portrait(person, 'person-chip-img'), person.name),
      ))),
    ),
    links.length > 0 && el('section', { class: 'detail-section' },
      el('h3', {}, t('event.sources')),
      el('ul', { class: 'source-list' }, links.map(sourceItem)),
    ),
    (previous || next) && el('nav', { class: 'detail-nav', 'aria-label': t('nav.timeline') },
      previous ? neighbourLink(previous, 'prev') : el('span'),
      next ? neighbourLink(next, 'next') : el('span'),
    ),
  ), 'detalle-titulo');
}

function neighbourLink(event, direction) {
  return el('a', { class: `detail-nav-link detail-nav-link--${direction}`, href: `#/evento/${event.id}` },
    el('span', { class: 'detail-nav-label' },
      direction === 'prev' && icon('arrowLeft'),
      t(direction === 'prev' ? 'event.prev' : 'event.next'),
      direction === 'next' && icon('arrowRight'),
    ),
    trEl('span', { class: 'detail-nav-title' }, event.title, { badge: false }),
  );
}

// Crédito, licencia y enlace a la colección original de un recurso.
function creditLine(resource) {
  const source = safeUrl(resource.source);
  const parts = [resource.credit, resource.license].filter(Boolean).join(' · ');
  if (!parts && !source) return null;
  return el('span', { class: 'credit' },
    parts,
    parts && source && ' · ',
    source && externalLink(source, {}, t('media.source')),
  );
}

function figure(image, className) {
  const description = tr(image.description);
  const img = el('img', { src: safeUrl(image.src), alt: description.text, loading: 'lazy', decoding: 'async' });
  if (description.text && description.lang !== getLang()) img.lang = description.lang;
  const caption = trEl('span', { class: 'caption' }, image.title, { badge: false });
  const credit = creditLine(image);
  return el('figure', { class: className }, img, (caption || credit) && el('figcaption', {}, caption, credit));
}

function player(resource) {
  const title = trEl('p', { class: 'player-title' }, resource.title, { badge: false });
  const transcript = paragraphs(resource.description, { class: 'transcript-text' });
  const src = safeUrl(resource.src);
  let media = null;

  if (resource.type === 'audio' && src) {
    media = el('audio', { controls: true, preload: 'none', src });
  } else if (resource.embed && VIDEO_EMBED_PREFIXES.some((prefix) => resource.embed.startsWith(prefix))) {
    // El video de YouTube o Vimeo recién se carga cuando la persona lo pide.
    const frame = el('div', { class: 'video-frame' });
    frame.append(el('button', {
      type: 'button',
      class: 'video-start',
      onclick: () => frame.replaceChildren(el('iframe', {
        src: `${resource.embed}?autoplay=1`,
        title: trText(resource.title) || t('event.playVideo'),
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin',
      })),
    }, icon('play'), el('span', {}, t('event.playVideo'))));
    media = frame;
  } else if (resource.type === 'video' && src) {
    media = el('video', { controls: true, preload: 'metadata', src });
  }
  if (!media) return null;

  return el('div', { class: 'player' },
    title, media,
    transcript && el('details', { class: 'transcript' }, el('summary', {}, t('event.transcript')), transcript),
    creditLine(resource) && el('p', { class: 'player-credit' }, creditLine(resource)),
  );
}

function sourceItem(resource) {
  const url = safeUrl(resource.src);
  const label = trText(resource.title) || url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const titleInfo = tr(resource.title);
  const link = isExternal(url)
    ? externalLink(url, { class: 'source-link' }, resource.type === 'document' && icon('document'), label)
    : el('a', { class: 'source-link', href: url }, icon('document'), label);
  if (titleInfo.text && titleInfo.lang !== getLang()) link.lang = titleInfo.lang;
  return el('li', {},
    link,
    trEl('span', { class: 'source-note' }, resource.description, { badge: false }),
    creditLine(resource),
  );
}

// ---------------------------------------------------------------------------
// Persona

export function portrait(person, className) {
  const src = safeUrl(person.portrait);
  if (src) return el('img', { class: className, src, alt: '', loading: 'lazy', decoding: 'async' });
  const initials = person.name.split(/\s+/).filter((word) => /^\p{Lu}/u.test(word)).map((word) => word[0]).slice(0, 2).join('');
  return el('span', { class: `${className} portrait-initials`, 'aria-hidden': 'true' }, initials || person.name[0]);
}

export function lifeYears(person) {
  if (person.born && person.died) return `${person.born} – ${person.died}`;
  if (person.born) return `${person.born} –`;
  if (person.died) return `– ${person.died}`;
  return '';
}

export function showPerson(person) {
  const events = eventsOf(person);
  const link = safeUrl(person.link);

  show(el('article', { class: 'detail-content person-detail' },
    el('header', { class: 'person-header' },
      portrait(person, 'person-portrait'),
      el('div', {},
        el('h2', { id: 'detalle-titulo', tabindex: '-1' }, person.name),
        lifeYears(person) && el('p', { class: 'person-years' }, lifeYears(person)),
        trEl('p', { class: 'person-role' }, person.role),
      ),
    ),
    paragraphs(person.bio, { class: 'detail-text' }),
    link && el('p', {}, externalLink(link, { class: 'source-link' }, t('people.more'))),
    events.length > 0 && el('section', { class: 'detail-section' },
      el('h3', {}, t('people.events')),
      el('ul', { class: 'event-links' }, events.map((event) => el('li', {},
        el('a', { href: `#/evento/${event.id}` },
          el('time', { datetime: isoDate(event) }, formatDate(event)),
          trEl('span', {}, event.title, { badge: false }),
        ),
      ))),
    ),
    person.portrait && person.portraitCredit && el('p', { class: 'credit person-credit' }, `${t('people.portraitCredit')}: ${person.portraitCredit}`),
  ), 'detalle-titulo');
}
