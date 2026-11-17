// Arranque del sitio y enrutador.
//
// Direcciones (después del #):
//   #/                línea de tiempo        #/evento/<id>    ficha de un evento
//   #/mapa            mapa                   #/mapa/<id>      mapa centrado en un lugar
//   #/personas        personas               #/persona/<id>   ficha de una persona
//   #/actividad       actividad educativa
// El idioma va antes del #, como ?lang=es | cy | en.

import { LANGS } from './config.js';
import { loadStrings, detectLang, setLang, getLang, t, applyStaticTexts } from './i18n.js';
import { loadData, data } from './data.js';
import { el } from './dom.js';
import { initDetail, showEvent, showPerson, closeDetail } from './detail.js';
import { renderTimeline, focusEventCard } from './views/timeline.js';
import { renderMap } from './views/map.js';
import { renderPeople, focusPersonCard } from './views/people.js';
import { renderActivity } from './views/activity.js';

const main = document.getElementById('contenido');

const VIEWS = {
  timeline: { hash: '#/', render: () => renderTimeline(main) },
  map: { hash: '#/mapa', render: (param) => renderMap(main, param) },
  people: { hash: '#/personas', render: () => renderPeople(main) },
  activity: { hash: '#/actividad', render: () => renderActivity(main) },
};
const VIEW_BY_SLUG = { '': 'timeline', mapa: 'map', personas: 'people', actividad: 'activity' };

let currentView = null; // vista dibujada en <main>
let currentParam = null;
let lastDetail = null; // { type, id } de la última ficha abierta, para devolver el foco
let inDetail = false; // la dirección actual es la de una ficha

function parseRoute() {
  const [slug = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (slug === 'evento') return { detail: 'event', id: param };
  if (slug === 'persona') return { detail: 'person', id: param };
  return { view: VIEW_BY_SLUG[slug] ?? 'timeline', param: param || null };
}

function showView(name, param = null, { force = false } = {}) {
  if (!force && currentView === name && currentParam === param) return;
  currentView = name;
  currentParam = param;
  VIEWS[name].render(param);
  for (const link of document.querySelectorAll('.main-nav a')) {
    if (link.dataset.view === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = name === 'timeline'
    ? `${t('site.title')}: ${t('site.subtitle')}`
    : `${t(`nav.${name}`)} · ${t('site.title')}`;
}

function route({ force = false } = {}) {
  const target = parseRoute();

  if (target.detail) {
    const item = target.detail === 'event' ? data.eventById.get(target.id) : data.personById.get(target.id);
    if (!item) { location.replace(VIEWS.timeline.hash); return; }
    // La ficha se abre sobre la vista en la que estaba la persona; si entró directo, sobre la que corresponde.
    if (!currentView || force) showView(currentView ?? (target.detail === 'event' ? 'timeline' : 'people'), currentParam, { force });
    lastDetail = { type: target.detail, id: target.id };
    inDetail = true;
    if (target.detail === 'event') showEvent(item); else showPerson(item);
    return;
  }

  const cameFromDetail = inDetail;
  inDetail = false;
  closeDetail();
  const firstRender = currentView === null;
  const changed = currentView !== target.view || currentParam !== target.param;
  showView(target.view, target.param, { force });

  if (cameFromDetail && !changed && lastDetail) {
    // Se cerró una ficha y se sigue en la misma vista: el foco vuelve a la tarjeta de origen.
    if (lastDetail.type === 'event') focusEventCard(lastDetail.id); else focusPersonCard(lastDetail.id);
  } else if (changed && !force && !firstRender) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

// Al cerrar una ficha (botón, Escape o clic afuera) se vuelve a la vista que quedó debajo.
function onDetailClosed() {
  const hash = VIEWS[currentView ?? 'timeline'].hash + (currentParam ? `/${currentParam}` : '');
  if (location.hash !== hash) location.hash = hash;
}

function setupLanguageSwitch() {
  for (const link of document.querySelectorAll('.lang-switch a')) {
    link.addEventListener('click', (click) => {
      click.preventDefault();
      changeLang(link.dataset.lang);
    });
  }
}

function markLanguage() {
  for (const link of document.querySelectorAll('.lang-switch a')) {
    link.href = `?lang=${link.dataset.lang}${location.hash}`;
    if (link.dataset.lang === getLang()) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

// Cambia el idioma sin recargar la página y sin perder el lugar.
function changeLang(lang) {
  if (!LANGS.includes(lang) || lang === getLang()) return;
  setLang(lang, { remember: true });
  history.replaceState(null, '', `?lang=${lang}${location.hash}`);
  applyStaticTexts();
  markLanguage();
  route({ force: true });
}

async function start() {
  setLang(detectLang());
  try {
    await Promise.all([loadStrings(), loadData()]);
  } catch (error) {
    console.error(error);
    main.replaceChildren(el('p', { class: 'notice notice--error' },
      'No se pudieron cargar los datos. Probá recargar la página. / Nid oedd modd llwytho\'r data. / The data could not be loaded.'));
    return;
  }
  applyStaticTexts();
  markLanguage();
  setupLanguageSwitch();
  initDetail(onDetailClosed);
  window.addEventListener('hashchange', () => { markLanguage(); route(); });
  route();
  document.documentElement.classList.add('is-ready');
}

start();
