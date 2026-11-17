// Carga los datos (site/data/*.json) y arma los índices para consultarlos.

import { DATA_FILES } from './config.js';

export const data = {
  events: [], people: [], places: [], categories: [],
  eventById: new Map(), personById: new Map(), placeById: new Map(), categoryById: new Map(),
};

async function loadJson(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`No se pudo leer ${file} (${response.status})`);
  return response.json();
}

export async function loadData() {
  const [events, people, places, categories] = await Promise.all([
    loadJson(DATA_FILES.events), loadJson(DATA_FILES.people),
    loadJson(DATA_FILES.places), loadJson(DATA_FILES.categories),
  ]);
  Object.assign(data, { events, people, places, categories });

  data.eventById = new Map(events.map((item) => [item.id, item]));
  data.personById = new Map(people.map((item) => [item.id, item]));
  data.placeById = new Map(places.map((item) => [item.id, item]));
  data.categoryById = new Map(categories.map((item) => [item.id, item]));

  // Cada categoría recibe un color del tema (--cat-1, --cat-2…) según su orden en la planilla.
  categories.forEach((category, index) => { category.color = `var(--cat-${(index % 6) + 1})`; });
}

export const categoryOf = (event) => data.categoryById.get(event.category) ?? null;
export const placeOf = (event) => data.placeById.get(event.place) ?? null;
export const peopleOf = (event) => (event.people ?? []).map((id) => data.personById.get(id)).filter(Boolean);
export const eventsAt = (place) => data.events.filter((event) => event.place === place.id);
export const eventsOf = (person) => data.events.filter((event) => event.people?.includes(person.id));
export const categoryColor = (event) => categoryOf(event)?.color ?? 'var(--cat-none)';

export const imagesOf = (event) => (event.resources ?? []).filter((resource) => resource.type === 'image');

// Número para ordenar por fecha (los eventos ya vienen ordenados; se usa en la actividad).
export const sortKey = (event) => event.year * 10000 + (event.month ?? 0) * 100 + (event.day ?? 0);
