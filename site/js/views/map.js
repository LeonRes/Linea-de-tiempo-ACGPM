// Vista de mapa: los lugares de la planilla con sus eventos.
// La lista de lugares debajo del mapa es también la alternativa accesible al mapa.

import { data, eventsAt } from '../data.js';
import { t, trText, formatDate, isoDate } from '../i18n.js';
import { el, trEl, icon } from '../dom.js';
import { MAP } from '../config.js';

let leafletLoading = null;

// Leaflet solo se descarga cuando alguien abre el mapa.
function loadLeaflet() {
  leafletLoading ??= new Promise((resolve, reject) => {
    document.head.append(el('link', { rel: 'stylesheet', href: 'vendor/leaflet/leaflet.css' }));
    document.head.append(el('script', {
      src: 'vendor/leaflet/leaflet.js',
      onload: () => resolve(window.L),
      onerror: () => { leafletLoading = null; reject(new Error('No se pudo cargar Leaflet')); },
    }));
  });
  return leafletLoading;
}

function eventLinks(place) {
  const events = eventsAt(place);
  if (events.length === 0) return el('p', { class: 'place-empty' }, t('map.noEvents'));
  return el('ul', { class: 'event-links' }, events.map((event) => el('li', {},
    el('a', { href: `#/evento/${event.id}` },
      el('time', { datetime: isoDate(event) }, formatDate(event)),
      trEl('span', {}, event.title, { badge: false }),
    ),
  )));
}

export async function renderMap(main, focusPlaceId) {
  const mapBox = el('div', { class: 'map', id: 'mapa', role: 'region', 'aria-label': t('map.title') });
  const toolbar = el('div', { class: 'map-toolbar', role: 'group', 'aria-label': t('map.title') });
  const places = el('ul', { class: 'place-list' });
  let showPlace = () => {};

  for (const place of data.places) {
    places.append(el('li', { class: 'place', id: `lugar-${place.id}` },
      el('h3', {}, el('button', { type: 'button', class: 'place-button', title: t('map.show'), onclick: () => showPlace(place, true) },
        icon('pin'), trEl('span', {}, place.name, { badge: false }))),
      trEl('p', { class: 'place-description' }, place.description, { badge: false }),
      eventLinks(place),
    ));
  }

  main.replaceChildren(
    el('section', { class: 'page-head' },
      el('h1', {}, t('map.title')),
      el('p', { class: 'page-lead' }, t('map.intro')),
    ),
    toolbar,
    mapBox,
    el('section', { class: 'places', 'aria-labelledby': 'lugares-titulo' },
      el('h2', { id: 'lugares-titulo' }, t('map.places')),
      places,
    ),
  );

  let L;
  try { L = await loadLeaflet(); }
  catch {
    mapBox.replaceWith(el('p', { class: 'notice' }, t('map.error')));
    toolbar.remove();
    return;
  }
  if (!mapBox.isConnected) return; // la persona ya cambió de vista

  // zoomSnap 0.5: permite un zoom intermedio para que Gran Bretaña y la Patagonia entren juntas sin que el mundo se repita.
  const map = L.map(mapBox, { scrollWheelZoom: false, worldCopyJump: true, minZoom: 2, zoomSnap: 0.5 });
  map.attributionControl.setPrefix(false);
  L.tileLayer(MAP.tiles, { attribution: MAP.attribution, maxZoom: MAP.maxZoom }).addTo(map);
  // La rueda del mouse recién hace zoom después de un clic, para no «atrapar» el desplazamiento de la página.
  map.on('focus', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());

  const markers = new Map();
  for (const place of data.places) {
    const name = trText(place.name);
    const marker = L.marker([place.lat, place.lon], {
      title: name,
      alt: name,
      icon: L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24] }),
    }).addTo(map);
    marker.bindPopup(() => el('div', { class: 'map-popup' },
      el('strong', { class: 'map-popup-title' }, name),
      eventLinks(place),
    ), { maxWidth: 280 });
    markers.set(place.id, marker);
  }

  const fit = (list) => {
    if (list.length === 0) return;
    map.fitBounds(L.latLngBounds(list.map((place) => [place.lat, place.lon])).pad(0.1), { maxZoom: MAP.placeZoom - 2 });
  };
  showPlace = (place, scroll) => {
    map.setView([place.lat, place.lon], MAP.placeZoom);
    markers.get(place.id)?.openPopup();
    if (scroll) mapBox.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // Botones para saltar entre los dos lados del Atlántico (según el hemisferio de cada lugar).
  const north = data.places.filter((place) => place.lat >= 0);
  const south = data.places.filter((place) => place.lat < 0);
  const zoomButton = (label, list) => el('button', { type: 'button', class: 'chip', onclick: () => { map.closePopup(); fit(list); } }, label);
  toolbar.append(zoomButton(t('map.all'), data.places));
  if (north.length && south.length) toolbar.append(zoomButton(t('map.north'), north), zoomButton(t('map.south'), south));

  const focusPlace = data.placeById.get(focusPlaceId);
  if (focusPlace) showPlace(focusPlace, false);
  else fit(data.places);
}
