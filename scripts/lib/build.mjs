// Convierte las pestañas de la planilla (ya leídas como matrices de texto) en los datos
// que usa la web, y arma la lista de problemas encontrados.
// Es una función pura: no lee archivos ni la red. Eso lo hace scripts/sync-sheet.mjs.

import { classifyRef, mediaSrc, videoEmbed, hasExtension } from './media.mjs';

export const LANGS = ['es', 'cy', 'en'];
export const DEFAULT_LANG = 'es';
const LANG_NAMES = { es: 'español', cy: 'galés', en: 'inglés' };

// Pestañas que se leen y las columnas sin las cuales no se puede trabajar.
export const TABS = {
  franjas: ['id', 'nombre_es'],
  lugares: ['id', 'nombre_es', 'latitud', 'longitud'],
  personas: ['id', 'nombre'],
  eventos: ['id', 'anio', 'titulo_es'],
  recursos: ['evento', 'tipo', 'archivo'],
};

// Colores de círculo que se pueden elegir en la columna «color» de los eventos (los define theme.css).
export const BUBBLE_COLORS = ['verde', 'azul', 'bordo', 'naranja', 'gris', 'blanco'];

const RESOURCE_TYPES = {
  imagen: 'image', foto: 'image', image: 'image',
  documento: 'document', document: 'document', pdf: 'document',
  audio: 'audio',
  video: 'video',
  enlace: 'link', link: 'link', vinculo: 'link',
};

// Error que frena toda la sincronización (la web queda como estaba).
export class FatalError extends Error {}

// ---------------------------------------------------------------------------
// Utilidades de texto

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function normalizeHeader(header) {
  const key = stripAccents(String(header ?? '').trim().toLowerCase().replace(/ñ/g, 'ni'))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return { ano: 'anio', ano_fin: 'anio_fin' }[key] ?? key;
}

// Identificador tolerante: "Zarpa el Mimosa" y "zarpa-el-mimosa" son el mismo.
export function slug(value) {
  return stripAccents(String(value ?? '').trim().toLowerCase().replace(/ñ/g, 'n'))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const clean = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim();

function parseNumber(value) {
  const text = clean(value).replace(/−/g, '-').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
}

function parseInteger(value) {
  const text = clean(value);
  return /^\d+$/.test(text) ? Number(text) : NaN;
}

function isDraft(value) {
  return ['no', 'n', 'false', '0', 'borrador'].includes(stripAccents(clean(value).toLowerCase()));
}

function httpUrl(value) {
  const text = clean(value);
  if (!/^https?:\/\//i.test(text)) return null;
  try { return new URL(text).href; } catch { return null; }
}

// ---------------------------------------------------------------------------
// Lectura de una pestaña

function readTable(tab, matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new FatalError(`La pestaña «${tab}» está vacía o no se pudo leer.`);
  }
  const headers = matrix[0].map(normalizeHeader);
  const missing = TABS[tab].filter((column) => !headers.includes(column));
  if (missing.length) {
    const names = missing.map((c) => `«${c.replace('anio', 'año')}»`).join(', ');
    throw new FatalError(
      `En la pestaña «${tab}» falta la columna ${names}. ` +
      'No cambies los nombres de la primera fila.'
    );
  }

  const records = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = {};
    let empty = true;
    headers.forEach((header, column) => {
      if (!header) return;
      const value = clean(matrix[i][column]);
      if (value) empty = false;
      cells[header] = value;
    });
    if (!empty) records.push({ row: i + 1, cells });
  }
  return records;
}

// Junta las columnas base_es, base_cy y base_en en un objeto { es, cy, en }.
function texts(cells, base) {
  const out = {};
  for (const lang of LANGS) {
    const value = cells[`${base}_${lang}`];
    if (value) out[lang] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------

export function build(tables, options = {}) {
  // Copia: los eventos que se conservan se modifican más abajo y el original se usa después para detectar cambios.
  const previous = structuredClone(options.previous ?? {});
  const resolveFile = options.resolveFile ?? defaultResolveFile;
  const issues = [];
  const stats = { events: 0, drafts: 0, resources: 0, people: 0, places: 0, lanes: 0 };

  const report = (level, tab, row, id, message) => issues.push({ level, tab, row, id: id || '', message });

  const pendingTranslations = (tab, row, id, fields) => {
    for (const lang of LANGS) {
      if (lang === DEFAULT_LANG) continue;
      const missing = Object.entries(fields)
        .filter(([, value]) => value[DEFAULT_LANG] && !value[lang])
        .map(([label]) => label);
      if (missing.length) {
        report('traduccion', tab, row, id, `Falta la traducción al ${LANG_NAMES[lang]} de: ${missing.join(', ')}.`);
      }
    }
  };

  // Lee una pestaña fila por fila. Si una fila tiene un error y ese mismo id ya estaba
  // publicado, se conserva la versión anterior en lugar de perderla.
  const readEntities = (tab, previousList, parseRow) => {
    const list = [];
    const seen = new Set();
    const before = new Map((previousList ?? []).map((item) => [item.id, item]));

    for (const { row, cells } of readTable(tab, tables[tab])) {
      const id = slug(cells.id);
      if (!id) { report('error', tab, row, '', 'Falta el identificador (columna «id»). La fila no se publica.'); continue; }
      if (seen.has(id)) { report('error', tab, row, id, `El identificador «${id}» está repetido. Se usa solo la primera fila.`); continue; }
      seen.add(id);

      const errors = [];
      const entity = parseRow({ row, cells, id, fail: (message) => errors.push(message) });
      if (entity === 'draft') { stats.drafts++; continue; }

      if (errors.length === 0) { list.push(entity); continue; }

      const kept = before.get(id);
      const outcome = kept ? 'Se mantiene la versión anterior publicada.' : 'La fila no se publica.';
      for (const message of errors) report('error', tab, row, id, `${message} ${outcome}`);
      if (kept) list.push(kept);
    }
    return list;
  };

  // --- franjas (Gales, Argentina, colonia galesa, Chubut…) -----------------
  const lanes = readEntities('franjas', previous.lanes, ({ row, cells, id, fail }) => {
    const name = texts(cells, 'nombre');
    if (!name.es) fail('Falta el nombre en español.');
    pendingTranslations('franjas', row, id, { nombre: name });
    const lane = { id, name };
    if (cells.bandera) {
      const file = resolveFile(classifyRef(cells.bandera), 'image');
      if (file.error) report('aviso', 'franjas', row, id, `Bandera: ${file.error} Se publica sin bandera.`);
      else lane.flag = file.src;
    }
    return lane;
  });
  const laneIds = new Set(lanes.map((lane) => lane.id));

  // --- lugares ------------------------------------------------------------
  const places = readEntities('lugares', previous.places, ({ row, cells, id, fail }) => {
    const name = texts(cells, 'nombre');
    const description = texts(cells, 'descripcion');
    const lat = parseNumber(cells.latitud);
    const lon = parseNumber(cells.longitud);
    if (!name.es) fail('Falta el nombre en español.');
    if (!(lat >= -90 && lat <= 90)) fail('La latitud tiene que ser un número entre -90 y 90.');
    if (!(lon >= -180 && lon <= 180)) fail('La longitud tiene que ser un número entre -180 y 180.');
    pendingTranslations('lugares', row, id, { nombre: name, descripción: description });
    const place = { id, name, lat, lon };
    if (Object.keys(description).length) place.description = description;
    return place;
  });
  const placeIds = new Set(places.map((p) => p.id));

  // --- personas -----------------------------------------------------------
  const people = readEntities('personas', previous.people, ({ row, cells, id, fail }) => {
    const person = { id, name: cells.nombre };
    if (!person.name) fail('Falta el nombre.');

    for (const [column, key, label] of [['nacimiento', 'born', 'nacimiento'], ['fallecimiento', 'died', 'fallecimiento']]) {
      if (!cells[column]) continue;
      const year = parseInteger(cells[column]);
      if (Number.isNaN(year)) report('aviso', 'personas', row, id, `El año de ${label} tiene que ser un número (por ejemplo 1837). Se ignora.`);
      else person[key] = year;
    }

    const role = texts(cells, 'rol');
    const bio = texts(cells, 'bio');
    if (Object.keys(role).length) person.role = role;
    if (Object.keys(bio).length) person.bio = bio;
    pendingTranslations('personas', row, id, { rol: role, biografía: bio });

    if (cells.retrato) {
      const file = resolveFile(classifyRef(cells.retrato), 'image');
      if (file.error) report('aviso', 'personas', row, id, `Retrato: ${file.error} Se publica sin retrato.`);
      else {
        if (file.warning) report('aviso', 'personas', row, id, `Retrato: ${file.warning}`);
        person.portrait = file.src;
        if (cells.retrato_credito) person.portraitCredit = cells.retrato_credito;
        else report('aviso', 'personas', row, id, 'El retrato no tiene crédito (columna «retrato_credito»).');
      }
    }
    if (cells.enlace) {
      const link = httpUrl(cells.enlace);
      if (link) person.link = link;
      else report('aviso', 'personas', row, id, 'El enlace tiene que empezar con http:// o https://. Se ignora.');
    }
    return person;
  });
  const peopleIds = new Set(people.map((p) => p.id));

  // --- eventos ------------------------------------------------------------
  const draftIds = new Set();
  const relatedRefs = new Map(); // id del evento → { row, refs } de la columna «relacionados», se resuelve al final
  const events = readEntities('eventos', previous.events, ({ row, cells, id, fail }) => {
    if (isDraft(cells.publicado)) { draftIds.add(id); return 'draft'; }
    const event = { id };

    const year = parseInteger(cells.anio);
    if (Number.isNaN(year) || year < 1000 || year > 2200) fail('Falta el año o no es un número de cuatro cifras.');
    event.year = year;

    if (cells.mes) {
      const month = parseInteger(cells.mes);
      if (!(month >= 1 && month <= 12)) fail('El mes tiene que ser un número del 1 al 12.');
      else event.month = month;
    }
    if (cells.dia) {
      const day = parseInteger(cells.dia);
      if (!event.month) fail('Para indicar el día hay que indicar también el mes.');
      else if (!(day >= 1 && day <= new Date(Date.UTC(year, event.month, 0)).getUTCDate())) fail('El día no existe en ese mes.');
      else event.day = day;
    }
    if (cells.anio_fin) {
      const endYear = parseInteger(cells.anio_fin);
      if (Number.isNaN(endYear) || endYear < year) fail('El año de fin tiene que ser un número igual o posterior al año.');
      else if (endYear > year) event.endYear = endYear;
    }

    if (cells.franja) {
      const lane = slug(cells.franja);
      if (laneIds.has(lane)) event.lane = lane;
      else report('aviso', 'eventos', row, id, `La franja «${cells.franja}» no existe en la pestaña «franjas». El evento se publica en la primera franja.`);
    } else {
      report('aviso', 'eventos', row, id, 'Falta la franja. El evento se publica en la primera franja.');
    }
    event.lane ??= lanes[0]?.id;
    if (cells.color) {
      const color = slug(cells.color).replace(/-/g, '');
      if (BUBBLE_COLORS.includes(color)) event.color = color;
      else report('aviso', 'eventos', row, id, `El color «${cells.color}» no existe. Usá: ${BUBBLE_COLORS.join(', ')}. Se usa el color de la franja.`);
    }
    if (cells.lugar) {
      const place = slug(cells.lugar);
      if (placeIds.has(place)) event.place = place;
      else report('aviso', 'eventos', row, id, `El lugar «${cells.lugar}» no existe en la pestaña «lugares». El evento se publica sin lugar.`);
    }
    event.people = [];
    for (const raw of (cells.personas || '').split(/[,;\n]/)) {
      const person = slug(raw);
      if (!person) continue;
      if (!peopleIds.has(person)) report('aviso', 'eventos', row, id, `La persona «${raw.trim()}» no existe en la pestaña «personas». Se ignora.`);
      else if (!event.people.includes(person)) event.people.push(person);
    }

    event.title = texts(cells, 'titulo');
    event.summary = texts(cells, 'resumen');
    event.body = texts(cells, 'texto');
    if (!event.title.es) fail('Falta el título en español.');
    if (!event.summary.es && !event.body.es) report('aviso', 'eventos', row, id, 'El evento no tiene resumen ni texto en español.');
    pendingTranslations('eventos', row, id, { título: event.title, resumen: event.summary, texto: event.body });

    if (cells.relacionados) relatedRefs.set(id, { row, refs: cells.relacionados.split(/[,;\n]/) });

    event.resources = [];
    return event;
  });

  if (events.length === 0) {
    throw new FatalError('No hay ningún evento válido para publicar. Revisá la pestaña «eventos».');
  }
  events.sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0));
  const eventsById = new Map(events.map((event) => [event.id, event]));
  for (const event of events) event.resources = []; // también en los que se conservaron de antes

  // «relacionados»: otros eventos que la ficha sugiere para seguir leyendo (además de los automáticos).
  for (const event of events) {
    const entry = relatedRefs.get(event.id);
    if (!entry) { delete event.related; continue; }
    event.related = [];
    for (const raw of entry.refs) {
      const other = slug(raw);
      if (!other || other === event.id || event.related.includes(other)) continue;
      if (eventsById.has(other)) event.related.push(other);
      else if (!draftIds.has(other)) report('aviso', 'eventos', entry.row, event.id, `El evento relacionado «${raw.trim()}» no existe en la pestaña «eventos». Se ignora.`);
    }
    if (event.related.length === 0) delete event.related;
  }

  // --- recursos -----------------------------------------------------------
  for (const { row, cells } of readTable('recursos', tables.recursos)) {
    const eventId = slug(cells.evento);
    const skip = (message) => report('error', 'recursos', row, eventId, `${message} El recurso no se publica.`);

    const event = eventsById.get(eventId);
    if (!event) {
      // Los recursos de un evento en borrador simplemente esperan; no es un error.
      if (!draftIds.has(eventId)) skip(`El evento «${cells.evento}» no existe o no se pudo publicar.`);
      continue;
    }
    const type = RESOURCE_TYPES[stripAccents(cells.tipo.toLowerCase())];
    if (!type) {
      skip(cells.tipo
        ? `El tipo «${cells.tipo}» no existe. Usá: imagen, documento, audio, video o enlace.`
        : 'Falta el tipo. Usá: imagen, documento, audio, video o enlace.');
      continue;
    }

    const ref = classifyRef(cells.archivo);
    const resource = { type };

    if (type === 'link') {
      if (ref.kind !== 'url' && ref.kind !== 'drive') { skip('Un enlace necesita una dirección web completa (https://…) en la columna «archivo».'); continue; }
      resource.src = httpUrl(cells.archivo);
    } else if (type === 'video' && ref.kind === 'url' && videoEmbed(ref.url)) {
      resource.src = ref.url;
      resource.embed = videoEmbed(ref.url);
    } else {
      const file = resolveFile(ref, type);
      if (file.error) { skip(file.error); continue; }
      if (file.warning) report('aviso', 'recursos', row, eventId, file.warning);
      resource.src = file.src;
      if (ref.kind === 'local' && !hasExtension(ref.name, type)) {
        report('aviso', 'recursos', row, eventId, `El archivo «${ref.name}» no parece ser de tipo ${cells.tipo}. Puede que no se vea bien.`);
      }
      if (ref.kind === 'url' && type === 'image') {
        report('aviso', 'recursos', row, eventId, 'La imagen está alojada en otro sitio y puede dejar de verse si la quitan. Es mejor subirla a Drive o a la carpeta media.');
      }
    }

    const title = texts(cells, 'titulo');
    const description = texts(cells, 'descripcion');
    if (Object.keys(title).length) resource.title = title;
    if (Object.keys(description).length) resource.description = description;
    if (cells.credito) resource.credit = cells.credito;
    if (cells.licencia) resource.license = cells.licencia;
    if (cells.fuente) {
      const source = httpUrl(cells.fuente);
      if (source) resource.source = source;
      else report('aviso', 'recursos', row, eventId, 'La fuente tiene que ser una dirección web (https://…). Se ignora.');
    }

    if (type === 'image' && !description.es) report('aviso', 'recursos', row, eventId, 'La imagen no tiene descripción en español. Las personas ciegas no van a saber qué muestra.');
    if ((type === 'audio' || type === 'video') && !description.es) report('aviso', 'recursos', row, eventId, 'El audio o video no tiene transcripción en español (columna «descripcion_es»).');
    if (type === 'link' && !title.es) report('aviso', 'recursos', row, eventId, 'El enlace no tiene título en español: se va a mostrar la dirección.');
    if (type === 'image' && !cells.credito) report('aviso', 'recursos', row, eventId, 'La imagen no tiene crédito (autor o institución).');
    pendingTranslations('recursos', row, eventId, { título: title, descripción: description });

    event.resources.push(resource);
    stats.resources++;
  }

  stats.events = events.length;
  stats.people = people.length;
  stats.places = places.length;
  stats.lanes = lanes.length;

  return { data: { events, people, places, lanes }, issues, stats };
}

// Sin acceso a disco ni a la red: los archivos locales se dan por buenos.
function defaultResolveFile(ref) {
  if (ref.kind === 'local') return { src: mediaSrc(ref.name) };
  if (ref.kind === 'url') return { src: ref.url };
  if (ref.kind === 'drive') return { error: 'No se pudo descargar el archivo de Drive.' };
  if (ref.kind === 'empty') return { error: 'Falta el archivo.' };
  return { error: `No se entiende el archivo: ${ref.reason}.` };
}
