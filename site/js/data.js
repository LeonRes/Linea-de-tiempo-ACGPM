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

// Sugerencias «para seguir explorando» desde la ficha de un evento.
// Primero los que la planilla indica en «relacionados»; después se completa con los eventos
// que comparten personas, lugar o franja, prefiriendo los más cercanos en el tiempo.
// Cada sugerencia lleva el motivo para mostrarlo: { event, reason: { type, item? } }.
export function relatedEvents(event, limit = 4) {
  const chosen = [];
  const taken = new Set([event.id]);
  for (const id of event.related ?? []) {
    const other = data.eventById.get(id);
    if (!other || taken.has(id)) continue;
    taken.add(id);
    chosen.push({ event: other, reason: { type: 'chosen' } });
  }

  const candidates = [];
  for (const other of data.events) {
    if (taken.has(other.id)) continue;
    const person = (other.people ?? []).find((id) => event.people?.includes(id));
    const samePlace = event.place && other.place === event.place;
    const sameLane = laneOf(other) === laneOf(event);
    const distance = Math.abs(other.year - event.year);
    const score = (person ? 4 : 0) + (samePlace ? 3 : 0) + (sameLane ? 1 : 0) + (distance <= 5 ? 1 : 0);
    if (!person && !samePlace && score < 2) continue; // solo cerca en el tiempo o solo misma franja: no alcanza
    const reason = person ? { type: 'person', item: data.personById.get(person) }
      : samePlace ? { type: 'place', item: placeOf(event) }
      : sameLane ? { type: 'lane', item: laneOf(event) }
      : { type: 'time' };
    candidates.push({ event: other, reason, score, distance });
  }
  candidates.sort((a, b) => b.score - a.score || a.distance - b.distance || sortKey(a.event) - sortKey(b.event));
  return [...chosen, ...candidates].slice(0, Math.max(limit, chosen.length));
}
