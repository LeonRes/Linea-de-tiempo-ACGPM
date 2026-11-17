// Vista principal: la línea de tiempo con filtro por categoría.

import { data, categoryOf, placeOf, categoryColor, imagesOf } from '../data.js';
import { t, trText, formatDate, isoDate } from '../i18n.js';
import { el, trEl, icon, safeUrl, announce } from '../dom.js';

let activeCategory = null; // null = todas las categorías

export function renderTimeline(main) {
  if (activeCategory && !data.categoryById.has(activeCategory)) activeCategory = null;

  const first = Math.min(...data.events.map((event) => event.year));
  const last = Math.max(...data.events.map((event) => event.endYear ?? event.year));
  const list = el('ol', { class: 'timeline' });

  main.replaceChildren(
    el('section', { class: 'intro' },
      data.events.length > 0 && el('p', { class: 'intro-span' }, first === last ? String(first) : `${first} – ${last}`),
      el('h1', { class: 'intro-title' }, t('site.title')),
      el('p', { class: 'intro-subtitle' }, t('site.subtitle')),
      el('p', { class: 'intro-lead' }, t('site.intro')),
      t('site.notice') && el('p', { class: 'notice' }, t('site.notice')),
    ),
    el('section', { class: 'timeline-section', 'aria-label': t('nav.timeline') },
      filterBar(() => drawEvents(list)),
      list,
    ),
  );
  drawEvents(list);
}

function filterBar(onChange) {
  const used = new Set(data.events.map((event) => event.category).filter(Boolean));
  const categories = data.categories.filter((category) => used.has(category.id));
  if (categories.length < 2) return null;

  const box = el('div', { class: 'filters', role: 'group', 'aria-label': t('filter.label') });
  const chip = (id, label, color) => el('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(activeCategory === id),
    style: color ? `--cat-color: ${color}` : null,
    onclick: (click) => {
      activeCategory = id;
      for (const button of box.children) button.setAttribute('aria-pressed', String(button === click.currentTarget));
      onChange();
      const shown = data.events.filter((event) => !id || event.category === id).length;
      announce(t('timeline.count', { n: shown }));
    },
  }, color && el('span', { class: 'chip-dot', 'aria-hidden': 'true' }), label);

  box.append(
    chip(null, t('filter.all')),
    ...categories.map((category) => chip(category.id, trText(category.name), category.color)),
  );
  return box;
}

function drawEvents(list) {
  const events = data.events.filter((event) => !activeCategory || event.category === activeCategory);
  if (events.length === 0) {
    list.replaceChildren(el('li', { class: 'timeline-empty' }, t('timeline.empty')));
    return;
  }

  // Un grupo por año; dentro, las tarjetas alternan a izquierda y derecha de la línea.
  const groups = [];
  for (const event of events) {
    const group = groups.at(-1);
    if (group && group.year === event.year) group.events.push(event);
    else groups.push({ year: event.year, events: [event] });
  }

  let index = 0;
  list.replaceChildren(...groups.map((group) => el('li', { class: 'year-group' },
    el('h2', { class: 'year' }, el('span', {}, String(group.year))),
    el('ol', { class: 'events' }, group.events.map((event) => eventCard(event, index++ % 2 === 0 ? 'left' : 'right'))),
  )));
}

function eventCard(event, side) {
  const category = categoryOf(event);
  const place = placeOf(event);
  const cover = imagesOf(event).map((image) => safeUrl(image.src)).find(Boolean);

  // El enlace está en el título y se extiende a toda la tarjeta con CSS (.event-link::after).
  const title = trEl('a', { class: 'event-link', href: `#/evento/${event.id}` }, event.title);

  return el('li', { class: `event event--${side}`, style: `--cat-color: ${categoryColor(event)}` },
    el('span', { class: 'event-dot', 'aria-hidden': 'true' }),
    el('article', { class: 'event-card' },
      cover && el('img', { class: 'event-thumb', src: cover, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', { class: 'event-body' },
        el('p', { class: 'event-meta' },
          el('time', { datetime: isoDate(event) }, formatDate(event)),
          category && el('span', { class: 'event-cat' }, trText(category.name)),
        ),
        el('h3', { class: 'event-title' }, title),
        trEl('p', { class: 'event-summary' }, event.summary, { badge: false }),
        el('p', { class: 'event-foot' },
          place && el('span', { class: 'event-place' }, icon('pin'), trText(place.name)),
          el('span', { class: 'event-more', 'aria-hidden': 'true' }, t('event.more'), icon('arrowRight')),
        ),
      ),
    ),
  );
}

// La usa el enrutador para devolver el foco a la tarjeta al cerrar la ficha.
export function focusEventCard(id) {
  document.querySelector(`.event-link[href="#/evento/${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
