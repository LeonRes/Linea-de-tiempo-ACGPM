// Vista principal: la línea de tiempo.
//
// Dos formas de verla, con el mismo estilo que la línea de tiempo impresa de la Asociación:
//   - «línea»: franjas horizontales (una por cada fila de la pestaña «franjas»), con su bandera
//     a la izquierda y la barra de décadas arriba y abajo. Se recorre hacia los costados.
//   - «lista»: los eventos uno debajo del otro, agrupados por década. Es la única en pantallas
//     angostas y la alternativa para quien la prefiera.

import { data, laneOf, placeOf, imagesOf, colorClasses } from '../data.js';
import { t, trText, formatDate, isoDate } from '../i18n.js';
import { el, trEl, icon, safeUrl, announce, setChildren } from '../dom.js';
import { TIMELINE } from '../config.js';

const narrowScreen = matchMedia(TIMELINE.listQuery);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let activeLane = null;    // null = todas las franjas
let chosenView = readSavedView();
let savedScroll = 0;      // posición horizontal de la línea, para conservarla al redibujar
let redraw = null;        // dibuja de nuevo la vista montada (cambio de tamaño de pantalla)

narrowScreen.addEventListener('change', () => redraw?.());

function readSavedView() {
  try { return localStorage.getItem('vista') === 'lista' ? 'list' : 'board'; } catch { return 'board'; }
}
function saveView(view) {
  try { localStorage.setItem('vista', view === 'list' ? 'lista' : 'linea'); } catch { /* sin almacenamiento */ }
}
const currentView = () => (narrowScreen.matches ? 'list' : chosenView);

export function renderTimeline(main) {
  if (activeLane && !data.laneById.has(activeLane)) activeLane = null;

  const first = Math.min(...data.events.map((event) => event.year));
  const last = Math.max(...data.events.map((event) => event.endYear ?? event.year));
  const holder = el('div', { class: 'timeline-holder' });
  const toolbar = el('div', { class: 'timeline-toolbar' });

  main.replaceChildren(
    el('section', { class: 'intro' },
      data.events.length > 0 && el('p', { class: 'intro-span' }, first === last ? String(first) : `${first} – ${last}`),
      el('h1', { class: 'intro-title' }, t('site.title')),
      el('p', { class: 'intro-subtitle' }, t('site.subtitle')),
      el('p', { class: 'intro-lead' }, t('site.intro')),
      t('site.notice') && el('p', { class: 'notice' }, t('site.notice')),
    ),
    el('section', { class: 'timeline-section', 'aria-label': t('nav.timeline') }, toolbar, holder),
  );

  redraw = () => {
    if (!holder.isConnected) { redraw = null; return; }
    drawToolbar(toolbar);
    if (currentView() === 'board') drawBoard(holder); else drawList(holder);
  };
  redraw();
}

// ---------------------------------------------------------------------------
// Barra de herramientas: franjas, vista y flechas

function drawToolbar(toolbar) {
  const view = currentView();
  toolbar.classList.toggle('is-sticky', view === 'board');
  const lanesInUse = data.lanes.filter((lane) => data.events.some((event) => laneOf(event) === lane));

  const chip = (lane) => el('button', {
    type: 'button',
    class: `chip${lane ? ` chip--lane ${lane.className}` : ''}`,
    'aria-pressed': String(activeLane === (lane?.id ?? null)),
    onclick: () => {
      activeLane = lane?.id ?? null;
      redraw();
      toolbar.querySelector('.lane-filter [aria-pressed="true"]')?.focus();
      const shown = data.events.filter((event) => !activeLane || laneOf(event)?.id === activeLane).length;
      announce(t('timeline.count', { n: shown }));
    },
  },
  lane && (safeUrl(lane.flag)
    ? el('img', { class: 'chip-flag', src: safeUrl(lane.flag), alt: '' })
    : el('span', { class: 'chip-dot', 'aria-hidden': 'true' })),
  lane ? trText(lane.name) : t('filter.all'));

  const viewButton = (value, label) => el('button', {
    type: 'button', class: 'segmented-option', 'aria-pressed': String(view === value),
    onclick: () => { chosenView = value; saveView(value); redraw(); toolbar.querySelector('.view-switch [aria-pressed="true"]')?.focus(); },
  }, label);

  setChildren(toolbar,
    lanesInUse.length > 1 && el('div', { class: 'lane-filter', role: 'group', 'aria-label': t('filter.label') },
      chip(null), ...lanesInUse.map(chip)),
    el('div', { class: 'timeline-controls' },
      !narrowScreen.matches && el('div', { class: 'segmented view-switch', role: 'group', 'aria-label': t('view.label') },
        viewButton('board', t('view.board')), viewButton('list', t('view.list'))),
      view === 'board' && el('div', { class: 'board-arrows' },
        el('button', { type: 'button', class: 'icon-button board-prev', 'aria-label': t('board.prev'), onclick: () => scrollBoard(-1) }, icon('arrowLeft')),
        el('button', { type: 'button', class: 'icon-button board-next', 'aria-label': t('board.next'), onclick: () => scrollBoard(1) }, icon('arrowRight')),
      ),
    ),
  );
}

function visibleEvents() {
  return data.events.filter((event) => !activeLane || laneOf(event)?.id === activeLane);
}

// La usa la ficha para que «anterior» y «siguiente» sigan la franja elegida en el filtro.
// Devuelve null si no hay filtro (se recorren todos los eventos).
export function filteredSequence() {
  const lane = activeLane && data.laneById.get(activeLane);
  return lane ? { lane, events: visibleEvents() } : null;
}

// ---------------------------------------------------------------------------
// Vista «línea»: franjas horizontales

// Antes de 1800 los eventos se agrupan por siglo (como en el afiche); después, por década.
const periodOf = (year) => (year < 1800 ? Math.floor(year / 100) * 100 : Math.floor(year / 10) * 10);

function periodsFor(events) {
  if (events.length === 0) return [];
  const starts = events.map((event) => periodOf(event.year));
  const min = Math.min(...starts);
  const max = Math.max(...starts);
  const periods = [];
  for (let p = min; p <= max; p = p < 1800 ? p + 100 : p + 10) periods.push(p);
  return periods;
}

function drawBoard(holder) {
  const events = visibleEvents();
  const lanes = data.lanes.filter((lane) => (activeLane ? lane.id === activeLane : events.some((event) => laneOf(event) === lane)));
  const periods = periodsFor(events);
  const column = new Map(periods.map((period, index) => [period, index + 2]));
  const lastRow = lanes.length + 2;

  // La última columna, vacía, estira la línea hasta el borde cuando hay pocas décadas.
  const grid = el('div', {
    class: 'board-grid',
    style: `grid-template-columns: var(--lane-label-width) repeat(${periods.length}, minmax(var(--period-min-width), max-content)) minmax(0, 1fr)`,
  });

  const axis = (row, extra) => [
    el('div', { class: `axis-corner ${extra}`, style: `grid-area: ${row} / 1`, 'aria-hidden': 'true' }),
    ...periods.map((period) => el('div', { class: `axis-cell ${extra}`, style: `grid-area: ${row} / ${column.get(period)}`, 'aria-hidden': 'true' },
      el('span', {}, String(period)))),
    el('div', { class: `axis-cell axis-filler ${extra}`, style: `grid-area: ${row} / ${periods.length + 2}`, 'aria-hidden': 'true' }),
  ];
  grid.append(...axis(1, 'axis--top'));

  lanes.forEach((lane, index) => {
    const row = index + 2;
    const flag = safeUrl(lane.flag);
    const labelId = `franja-${lane.id}`;
    const section = el('section', { class: `lane ${lane.className}`, 'aria-labelledby': labelId },
      el('div', { class: 'lane-band', style: `grid-row: ${row}; grid-column: 1 / -1`, 'aria-hidden': 'true' }),
      el('h2', { class: 'lane-label', id: labelId, style: `grid-area: ${row} / 1` },
        flag && el('img', { class: 'lane-flag', src: flag, alt: '' }),
        el('span', { class: 'lane-name' }, trText(lane.name)),
      ),
    );
    for (const period of periods) {
      const inCell = events.filter((event) => laneOf(event) === lane && periodOf(event.year) === period);
      if (inCell.length === 0) continue;
      section.append(el('ol', { class: 'lane-cell', style: `grid-area: ${row} / ${column.get(period)}` },
        inCell.map((event) => el('li', { class: `lane-item${coverOf(event) ? ' lane-item--capsule' : ''}` }, bubble(event)))));
    }
    grid.append(section);
  });

  grid.append(...axis(lastRow, 'axis--bottom'));

  const board = el('div', {
    class: 'board', tabindex: '0', role: 'region', 'aria-label': t('board.label'),
    onscroll: () => { savedScroll = board.scrollLeft; updateArrows(board); },
  }, grid);

  setChildren(holder,
    events.length === 0 ? el('p', { class: 'notice' }, t('timeline.empty')) : board,
    events.length > 0 && el('p', { class: 'board-hint' }, t('board.hint')),
  );
  board.scrollLeft = savedScroll;
  enableDragToScroll(board);
  requestAnimationFrame(() => updateArrows(board));
}

const coverOf = (event) => imagesOf(event).map((image) => safeUrl(image.src)).find(Boolean);

// Un evento en la línea: círculo de color o, si tiene foto, «cápsula» blanca con la foto arriba.
function bubble(event) {
  const cover = coverOf(event);
  const label = el('span', { class: 'bubble-text' },
    el('time', { class: 'bubble-year', datetime: isoDate(event) }, event.endYear ? `${event.year}–${event.endYear}` : String(event.year)),
    trEl('span', { class: 'bubble-title' }, event.title, { badge: false }),
  );
  return el('a', {
    class: `${cover ? 'capsule' : 'bubble'} ${colorClasses(event)}`,
    href: `#/evento/${event.id}`,
    dataset: { event: event.id },
  }, cover && el('img', { class: 'capsule-photo', src: cover, alt: '', loading: 'lazy', decoding: 'async' }), label);
}

function scrollBoard(direction) {
  const board = document.querySelector('.board');
  if (!board) return;
  board.scrollBy({ left: direction * board.clientWidth * 0.75, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function updateArrows(board) {
  const max = board.scrollWidth - board.clientWidth - 2;
  const prev = document.querySelector('.board-prev');
  const next = document.querySelector('.board-next');
  if (prev) prev.disabled = board.scrollLeft <= 2;
  if (next) next.disabled = board.scrollLeft >= max;
}

// Con el mouse se puede arrastrar la línea para moverla (como un mapa).
function enableDragToScroll(board) {
  let start = null;
  let moved = false;
  board.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, left: board.scrollLeft };
    moved = false;
  });
  board.addEventListener('pointermove', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; board.classList.add('is-dragging'); board.setPointerCapture(event.pointerId); }
    board.scrollLeft = start.left - dx;
  });
  const stop = () => { start = null; board.classList.remove('is-dragging'); };
  board.addEventListener('dragstart', (event) => event.preventDefault()); // sin «arrastrar enlace» del navegador
  board.addEventListener('pointerup', stop);
  board.addEventListener('pointercancel', stop);
  // Si se arrastró, el clic que sigue no abre el evento.
  board.addEventListener('click', (event) => {
    if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
  }, true);
}

// ---------------------------------------------------------------------------
// Vista «lista»: por décadas

function drawList(holder) {
  const events = visibleEvents();
  if (events.length === 0) {
    holder.replaceChildren(el('p', { class: 'notice' }, t('timeline.empty')));
    return;
  }

  const groups = [];
  for (const event of events) {
    const decade = periodOf(event.year);
    const group = groups.at(-1);
    if (group && group.decade === decade) group.events.push(event);
    else groups.push({ decade, events: [event] });
  }

  holder.replaceChildren(el('ol', { class: 'tl-list' }, groups.map((group) => el('li', { class: 'tl-decade' },
    el('h2', { class: 'tl-decade-label' }, el('span', {}, String(group.decade))),
    el('ol', { class: 'tl-items' }, group.events.map(listItem)),
  ))));
}

function listItem(event) {
  const lane = laneOf(event);
  const place = placeOf(event);
  const cover = coverOf(event);
  const flag = safeUrl(lane?.flag);

  return el('li', { class: `tl-item ${colorClasses(event)}` },
    el('a', { class: 'tl-card', href: `#/evento/${event.id}`, dataset: { event: event.id } },
      cover
        ? el('img', { class: 'tl-photo', src: cover, alt: '', loading: 'lazy', decoding: 'async' })
        : el('span', { class: 'tl-dot', 'aria-hidden': 'true' }, String(event.year)),
      el('span', { class: 'tl-text' },
        el('span', { class: 'tl-meta' },
          el('time', { datetime: isoDate(event) }, formatDate(event)),
          lane && el('span', { class: 'tl-lane' }, flag && el('img', { src: flag, alt: '' }), trText(lane.name)),
        ),
        trEl('span', { class: 'tl-title' }, event.title),
        trEl('span', { class: 'tl-summary' }, event.summary, { badge: false }),
        place && el('span', { class: 'tl-place' }, icon('pin'), trText(place.name)),
      ),
    ),
  );
}

// La usa el enrutador para devolver el foco al evento al cerrar la ficha.
export function focusEventCard(id) {
  document.querySelector(`#contenido [data-event="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
