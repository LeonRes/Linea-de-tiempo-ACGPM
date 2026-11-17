// Pruebas del lector de la planilla. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, toCsv } from '../lib/csv.mjs';
import { classifyRef, videoEmbed, mediaSrc } from '../lib/media.mjs';
import { build, FatalError, slug, normalizeHeader } from '../lib/build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLANTILLA = path.join(ROOT, 'scripts', 'plantilla');
const TAB_NAMES = ['franjas', 'lugares', 'personas', 'eventos', 'recursos'];

// Copia fresca de la plantilla como matrices, para modificarla en cada prueba.
function sampleTables() {
  return Object.fromEntries(TAB_NAMES.map((tab) => [tab, parseCsv(readFileSync(path.join(PLANTILLA, `${tab}.csv`), 'utf8'))]));
}

// Cambia una celda: setCell(tables, 'eventos', 'desembarco', 'titulo_es', '')
function setCell(tables, tab, id, column, value) {
  const [header, ...rows] = tables[tab];
  const col = header.findIndex((h) => normalizeHeader(h) === column);
  const row = rows.find((r) => r[0] === id);
  assert.ok(col !== -1 && row, `no existe ${tab}/${id}/${column}`);
  row[col] = value;
}

const issuesFor = (result, id) => result.issues.filter((issue) => issue.id === id);

// --- CSV ------------------------------------------------------------------

test('CSV: comillas, comas, saltos de línea, BOM y CRLF', () => {
  const text = '﻿a,b,c\r\n"uno, dos","dice ""hola""","línea 1\nlínea 2"\r\n,,\n';
  assert.deepEqual(parseCsv(text), [['a', 'b', 'c'], ['uno, dos', 'dice "hola"', 'línea 1\nlínea 2'], ['', '', '']]);
  const rows = [['x', 'y,z'], ['"q"', 'a\nb']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

// --- Archivos y enlaces ---------------------------------------------------

test('reconoce enlaces de Google Drive', () => {
  for (const url of [
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing',
    'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp',
    'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp',
  ]) assert.deepEqual(classifyRef(url), { kind: 'drive', id: '1AbCdEfGhIjKlMnOp' }, url);
});

test('distingue archivos locales, direcciones web y valores inválidos', () => {
  assert.deepEqual(classifyRef(' mimosa.jpg '), { kind: 'local', name: 'mimosa.jpg' });
  assert.deepEqual(classifyRef('media/fotos/a.jpg'), { kind: 'local', name: 'fotos/a.jpg' });
  assert.equal(classifyRef('https://example.org/a.jpg').kind, 'url');
  assert.equal(classifyRef('').kind, 'empty');
  assert.equal(classifyRef('../secreto.txt').kind, 'invalid');
  assert.equal(classifyRef('javascript:alert(1)').kind, 'invalid');
  assert.equal(mediaSrc('fotos/año 1865.jpg'), 'media/fotos/a%C3%B1o%201865.jpg');
});

test('convierte videos de YouTube y Vimeo en direcciones para incrustar', () => {
  const yt = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
  assert.equal(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), yt);
  assert.equal(videoEmbed('https://youtu.be/dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://youtube.com/shorts/dQw4w9WgXcQ'), yt);
  assert.equal(videoEmbed('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(videoEmbed('https://example.org/video.mp4'), null);
});

test('identificadores tolerantes a mayúsculas, acentos y espacios', () => {
  assert.equal(slug('  Fundación de Rawson '), 'fundacion-de-rawson');
  assert.equal(slug('Año Ñandú'), 'ano-nandu');
  assert.equal(normalizeHeader('Año'), 'anio');
  assert.equal(normalizeHeader('Título ES'), 'titulo_es');
});

// --- Planilla completa ----------------------------------------------------

test('la plantilla de muestra se lee sin errores ni avisos', () => {
  const { data, issues, stats } = build(sampleTables());
  assert.deepEqual(issues, []);
  assert.equal(stats.events, 12);
  assert.equal(stats.lanes, 4);
  const years = data.events.map((e) => e.year * 10000 + (e.month ?? 0) * 100 + (e.day ?? 0));
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'ordenados por fecha');
  const mimosa = data.events.find((e) => e.id === 'embarque-en-liverpool');
  assert.equal(mimosa.lane, 'gales');
  assert.equal(mimosa.month, 5);
  assert.equal(mimosa.day, 25);
  assert.equal(mimosa.resources.length, 3);
  assert.equal(mimosa.resources[0].src, 'media/mimosa.jpg');
  assert.equal(data.events.find((e) => e.id === 'ley-de-inmigracion').color, 'naranja');
  assert.equal(data.lanes[0].flag, 'media/franjas/gales.jpg');
});

test('falta una columna obligatoria: se frena todo', () => {
  const tables = sampleTables();
  tables.eventos[0][tables.eventos[0].indexOf('titulo_es')] = 'titulo';
  assert.throws(() => build(tables), FatalError);
});

test('evento sin título en español: no se publica', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'titulo_es', '');
  const result = build(tables);
  assert.equal(result.data.events.some((e) => e.id === 'desembarco'), false);
  assert.equal(issuesFor(result, 'desembarco').filter((i) => i.level === 'error').length > 0, true);
});

test('evento con error: se conserva la versión publicada antes', () => {
  const before = build(sampleTables()).data;
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'anio', 'mil ochocientos');
  const result = build(tables, { previous: before });
  const kept = result.data.events.find((e) => e.id === 'desembarco');
  assert.equal(kept.year, 1865);
  assert.match(issuesFor(result, 'desembarco')[0].message, /versión anterior/);
});

test('fechas imposibles', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'mes', '2');
  setCell(tables, 'eventos', 'desembarco', 'dia', '29');
  assert.equal(build(tables).data.events.some((e) => e.id === 'desembarco'), false, '1865 no es bisiesto');

  setCell(tables, 'eventos', 'desembarco', 'anio', '1864');
  assert.equal(build(tables).data.events.find((e) => e.id === 'desembarco').day, 29, '1864 sí es bisiesto');

  setCell(tables, 'eventos', 'desembarco', 'mes', '');
  assert.equal(build(tables).data.events.some((e) => e.id === 'desembarco'), false, 'día sin mes');
});

test('borradores: no se publican y sus recursos no dan error', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'embarque-en-liverpool', 'publicado', 'no');
  const result = build(tables);
  assert.equal(result.data.events.some((e) => e.id === 'embarque-en-liverpool'), false);
  assert.equal(result.stats.drafts, 1);
  assert.deepEqual(result.issues, []);
});

test('franja, color, lugar o persona inexistentes: aviso y se publica igual', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'franja', 'inventada');
  setCell(tables, 'eventos', 'desembarco', 'color', 'violeta');
  setCell(tables, 'eventos', 'desembarco', 'personas', 'lewis-jones, nadie');
  const result = build(tables);
  const event = result.data.events.find((e) => e.id === 'desembarco');
  assert.equal(event.lane, 'gales', 'va a la primera franja');
  assert.equal(event.color, undefined);
  assert.deepEqual(event.people, ['lewis-jones']);
  assert.equal(issuesFor(result, 'desembarco').filter((i) => i.level === 'aviso').length, 3);
});

test('colores escritos con mayúsculas o acentos', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'color', 'Bordó');
  assert.equal(build(tables).data.events.find((e) => e.id === 'desembarco').color, 'bordo');
});

test('acepta referencias escritas «a mano» (mayúsculas y acentos)', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'lugar', 'Puerto Madryn');
  setCell(tables, 'eventos', 'desembarco', 'personas', 'Lewis Jones');
  const event = build(tables).data.events.find((e) => e.id === 'desembarco');
  assert.equal(event.place, 'puerto-madryn');
  assert.deepEqual(event.people, ['lewis-jones']);
});

test('traducción faltante: se avisa pero se publica', () => {
  const tables = sampleTables();
  setCell(tables, 'eventos', 'desembarco', 'titulo_cy', '');
  const result = build(tables);
  assert.equal(result.data.events.find((e) => e.id === 'desembarco').title.cy, undefined);
  assert.deepEqual(issuesFor(result, 'desembarco').map((i) => i.level), ['traduccion']);
});

test('coordenadas con coma decimal y coordenadas inválidas', () => {
  const tables = sampleTables();
  setCell(tables, 'lugares', 'rawson', 'latitud', '-43,3002');
  assert.equal(build(tables).data.places.find((p) => p.id === 'rawson').lat, -43.3002);
  setCell(tables, 'lugares', 'rawson', 'latitud', '-143');
  assert.equal(build(tables).data.places.some((p) => p.id === 'rawson'), false);
});

test('recursos: tipo desconocido, enlace sin dirección e imagen sin descripción', () => {
  const tables = sampleTables();
  const header = tables.recursos[0];
  const row = (values) => header.map((h) => values[normalizeHeader(h)] ?? '');
  tables.recursos.push(
    row({ evento: 'desembarco', tipo: 'maqueta', archivo: 'x.jpg' }),
    row({ evento: 'desembarco', tipo: 'enlace', archivo: 'no-es-una-direccion' }),
    row({ evento: 'desembarco', tipo: 'imagen', archivo: 'punta-cuevas.jpg', credito: 'Alguien' }),
    row({ evento: 'desembarco', tipo: 'video', archivo: 'https://youtu.be/dQw4w9WgXcQ', descripcion_es: 'Transcripción' }),
  );
  const result = build(tables);
  const event = result.data.events.find((e) => e.id === 'desembarco');
  assert.equal(event.resources.length, 3);
  assert.equal(event.resources[2].embed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  const levels = issuesFor(result, 'desembarco').map((i) => i.level);
  assert.equal(levels.filter((l) => l === 'error').length, 2);
  assert.ok(levels.includes('aviso'));
});

test('el script de sincronización funciona en modo revisión con la plantilla', () => {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'sync-sheet.mjs'), '--desde', PLANTILLA, '--revisar'], { encoding: 'utf8' });
  assert.match(output, /Eventos publicados: 12/);
  assert.match(output, /Errores: 0/);
});
