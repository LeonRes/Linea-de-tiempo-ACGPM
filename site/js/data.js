// Carga los datos (site/data/*.json) y arma los índices para consultarlos.

import { DATA_FILES } from './config.js';

export const data = {
  events: [], people: [], places: [], lanes: [],
  eventById: new Map(), personById: new Map(), placeById: new Map(), laneById: new Map(),
};

async function loadJson(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`No se pudo leer ${file} (${response.status})`);
  return response.json();
}

export async function loadData() {
  const [events, people, places, lanes] = await Promise.all([
    loadJson(DATA_FILES.events), loadJson(DATA_FILES.people),
    loadJson(DATA_FILES.places), loadJson(DATA_FILES.lanes),
  ]);
  Object.assign(data, { events, people, places, lanes });

  data.eventById = new Map(events.map((item) => [item.id, item]));
  data.personById = new Map(people.map((item) => [item.id, item]));
  data.placeById = new Map(places.map((item) => [item.id, item]));
  data.laneById = new Map(lanes.map((item) => [item.id, item]));

  // Cada franja toma los colores del tema (--lane-1-*, --lane-2-*…) según su orden en la planilla.
  lanes.forEach((lane, index) => { lane.className = `lane-${(index % 6) + 1}`; });
}

export const laneOf = (event) => data.laneById.get(event.lane) ?? data.lanes[0] ?? null;
export const placeOf = (event) => data.placeById.get(event.place) ?? null;
export const peopleOf = (event) => (event.people ?? []).map((id) => data.personById.get(id)).filter(Boolean);
export const eventsAt = (place) => data.events.filter((event) => event.place === place.id);
export const eventsOf = (person) => data.events.filter((event) => event.people?.includes(person.id));
export const imagesOf = (event) => (event.resources ?? []).filter((resource) => resource.type === 'image');

// Clases de color de un evento: la de su franja y, si la planilla indica otro color, la de ese color.
export function colorClasses(event) {
  return [laneOf(event)?.className ?? 'lane-1', event.color && `bubble--${event.color}`].filter(Boolean).join(' ');
}

// Número para ordenar por fecha (los eventos ya vienen ordenados; se usa en la actividad).
export const sortKey = (event) => event.year * 10000 + (event.month ?? 0) * 100 + (event.day ?? 0);
