#!/usr/bin/env node
// Copia el contenido de la planilla de Google a los archivos JSON que lee la web.
//
//   node scripts/sync-sheet.mjs                  lee la planilla indicada en scripts/sheet.config.json
//   node scripts/sync-sheet.mjs --desde <dir>    lee <dir>/<pestaña>.csv (sin internet; para pruebas)
//   node scripts/sync-sheet.mjs --revisar        solo revisa la planilla y muestra los problemas: no escribe nada
//
// Si hay un problema grave (no se puede leer la planilla, falta una columna) no escribe
// nada y termina con error: la web queda como estaba.

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { build, TABS, FatalError, normalizeHeader } from './lib/build.mjs';
import { classifyRef, mediaSrc, extensionFromContentType } from './lib/media.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'site', 'data');
const MEDIA_DIR = path.join(ROOT, 'site', 'media');
const CONFIG_FILE = path.join(ROOT, 'scripts', 'sheet.config.json');

const DATA_FILES = { events: 'events.json', people: 'people.json', places: 'places.json', categories: 'categories.json' };
const REPORT_FILE = 'sync-report.json';

const HEAVY_IMAGE_BYTES = 1.5 * 1024 * 1024; // aviso: la imagen tarda en cargar
const MAX_FILE_BYTES = 50 * 1024 * 1024; // GitHub rechaza archivos de más de 100 MB

// ---------------------------------------------------------------------------
// Lectura de las pestañas

async function fetchWithRetry(url, { timeout = 30_000, attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw lastError;
}

async function readTablesFromSheet(config) {
  if (!config.spreadsheetId || config.spreadsheetId.startsWith('PEGAR')) {
    throw new FatalError('Falta el identificador de la planilla en scripts/sheet.config.json.');
  }
  const tables = {};
  for (const tab of Object.keys(TABS)) {
    const gid = config.tabs?.[tab];
    if (gid === undefined || gid === null) {
      throw new FatalError(`Falta el número (gid) de la pestaña «${tab}» en scripts/sheet.config.json.`);
    }
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv&gid=${gid}`;
    let response;
    try { response = await fetchWithRetry(url); }
    catch (error) { throw new FatalError(`No se pudo conectar con Google para leer la pestaña «${tab}» (${error.message}).`); }

    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.includes('text/csv')) {
      throw new FatalError(
        `No se pudo leer la pestaña «${tab}» (respuesta ${response.status}). ` +
        'Revisá que la planilla siga compartida como «Cualquier persona que tenga el enlace: lector» ' +
        'y que la pestaña no haya sido borrada.'
      );
    }
    tables[tab] = parseCsv(await response.text());
  }
  return tables;
}

async function readTablesFromDir(dir) {
  const tables = {};
  for (const tab of Object.keys(TABS)) {
    const file = path.join(dir, `${tab}.csv`);
    if (!existsSync(file)) throw new FatalError(`No existe el archivo ${file}.`);
    tables[tab] = parseCsv(await readFile(file, 'utf8'));
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Archivos de Google Drive: se copian al repositorio para que la web no dependa de Drive.

async function findDriveCopy(id) {
  const dir = path.join(MEDIA_DIR, 'drive');
  if (!existsSync(dir)) return null;
  const match = (await readdir(dir)).find((name) => name.startsWith(`${id}.`));
  return match ? `drive/${match}` : null;
}

// Devuelve { name, size } (ruta dentro de site/media) o { error }. Con write: false solo comprueba.
async function downloadFromDrive(id, { write }) {
  const cached = await findDriveCopy(id);
  if (cached) return { name: cached, size: (await stat(path.join(MEDIA_DIR, cached))).size };

  let response;
  try {
    response = await fetchWithRetry(`https://drive.usercontent.google.com/download?id=${id}&export=download`, { timeout: 120_000 });
  } catch (error) {
    return { error: `No se pudo descargar el archivo de Drive (${error.message}).` };
  }
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || type.includes('text/html')) {
    return { error: 'No se pudo descargar el archivo de Drive. Revisá que esté compartido como «Cualquier persona que tenga el enlace».' };
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fromName = disposition.match(/filename\*?=(?:UTF-8'')?"?[^";]*\.([A-Za-z0-9]{2,5})"?/i)?.[1]?.toLowerCase();
  const extension = extensionFromContentType(type) ?? fromName;
  if (!extension) return { error: `El archivo de Drive tiene un formato que no se reconoce (${type}).` };

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) return { error: 'El archivo de Drive pesa más de 50 MB y no se puede publicar.' };

  const name = `drive/${id}.${extension}`;
  if (write) {
    await mkdir(path.join(MEDIA_DIR, 'drive'), { recursive: true });
    await writeFile(path.join(MEDIA_DIR, name), bytes);
  }
  return { name, size: bytes.length };
}

// Descarga por adelantado todos los archivos de Drive mencionados en la planilla.
async function collectDriveFiles(tables, { offline, write }) {
  const ids = new Set();
  const scan = (tab, column) => {
    const matrix = tables[tab];
    const index = (matrix[0] ?? []).findIndex((header) => normalizeHeader(header) === column);
    if (index === -1) return;
    for (const row of matrix.slice(1)) {
      const ref = classifyRef(row[index]);
      if (ref.kind === 'drive') ids.add(ref.id);
    }
  };
  scan('recursos', 'archivo');
  scan('personas', 'retrato');

  const result = new Map();
  for (const id of ids) {
    if (!offline) { result.set(id, await downloadFromDrive(id, { write })); continue; }
    const cached = await findDriveCopy(id);
    result.set(id, cached
      ? { name: cached, size: (await stat(path.join(MEDIA_DIR, cached))).size }
      : { error: 'Sin conexión: no se descargó el archivo de Drive.' });
  }
  return result;
}

async function makeFileResolver(driveFiles) {
  const sizes = new Map();
  const localInfo = async (name) => {
    try { return (await stat(path.join(MEDIA_DIR, name))).size; } catch { return null; }
  };
  // build() es sincrónico: se averigua el tamaño de todo site/media por adelantado.
  const walk = async (dir, prefix = '') => {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), `${relative}/`);
      else sizes.set(relative, await localInfo(relative));
    }
  };
  await walk(MEDIA_DIR);
  // Archivos de Drive revisados pero no guardados (modo --revisar).
  for (const file of driveFiles.values()) if (file.name && !sizes.has(file.name)) sizes.set(file.name, file.size);

  const local = (name, type) => {
    if (!sizes.has(name)) return { error: `No existe el archivo «${name}» en la carpeta media. Revisá el nombre (mayúsculas, espacios y extensión).` };
    const megabytes = (sizes.get(name) / 1024 / 1024).toFixed(1).replace('.', ',');
    const warning = type === 'image' && sizes.get(name) > HEAVY_IMAGE_BYTES
      ? `La imagen pesa ${megabytes} MB y va a tardar en cargar. Conviene achicarla a unos 1600 píxeles de ancho.`
      : undefined;
    return { src: mediaSrc(name), warning };
  };

  return (ref, type) => {
    if (ref.kind === 'empty') return { error: 'Falta el archivo.' };
    if (ref.kind === 'invalid') return { error: `No se entiende el archivo: ${ref.reason}.` };
    if (ref.kind === 'url') return { src: ref.url };
    if (ref.kind === 'local') return local(ref.name, type);
    const drive = driveFiles.get(ref.id);
    if (!drive || drive.error) return { error: drive?.error ?? 'No se pudo descargar el archivo de Drive.' };
    return local(drive.name, type);
  };
}

// ---------------------------------------------------------------------------

const toJson = (value) => JSON.stringify(value, null, 2) + '\n';

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

function printSummary(stats, issues, changed, dryRun) {
  const count = (level) => issues.filter((issue) => issue.level === level).length;
  const lines = [
    `Eventos publicados: ${stats.events} (borradores: ${stats.drafts})`,
    `Recursos: ${stats.resources} · Personas: ${stats.people} · Lugares: ${stats.places} · Categorías: ${stats.categories}`,
    `Errores: ${count('error')} · Avisos: ${count('aviso')} · Traducciones pendientes: ${count('traduccion')}`,
    !changed ? 'Sin cambios desde la última sincronización.'
      : dryRun ? 'Hay cambios respecto de lo publicado (modo revisión: no se escribió nada).'
        : 'Hay cambios: se actualizaron los archivos de site/data.',
  ];
  console.log(lines.join('\n'));
  for (const issue of issues.filter((i) => i.level !== 'traduccion')) {
    console.log(`  [${issue.level}] ${issue.tab}, fila ${issue.row}${issue.id ? ` (${issue.id})` : ''}: ${issue.message}`);
  }
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--revisar');
  const fromIndex = args.indexOf('--desde');
  const fromDir = fromIndex !== -1 ? args[fromIndex + 1] : null;
  if (fromIndex !== -1 && !fromDir) throw new FatalError('Después de --desde va la carpeta con los CSV.');

  const tables = fromDir
    ? await readTablesFromDir(path.resolve(fromDir))
    : await readTablesFromSheet(await readJson(CONFIG_FILE, {}));

  const previous = {};
  for (const [key, file] of Object.entries(DATA_FILES)) previous[key] = await readJson(path.join(DATA_DIR, file), []);

  const driveFiles = await collectDriveFiles(tables, { offline: Boolean(fromDir), write: !dryRun });
  const resolveFile = await makeFileResolver(driveFiles);
  const { data, issues, stats } = build(tables, { previous, resolveFile });

  // Solo se escribe si algo cambió: así no se genera un commit por hora sin motivo.
  const oldReport = await readJson(path.join(DATA_DIR, REPORT_FILE), null);
  const fingerprint = (d, s, i) => JSON.stringify([d, s, i]);
  const changed = !oldReport
    || fingerprint(previous, oldReport.stats, oldReport.issues) !== fingerprint(data, stats, issues);

  if (changed && !dryRun) {
    await mkdir(DATA_DIR, { recursive: true });
    for (const [key, file] of Object.entries(DATA_FILES)) await writeFile(path.join(DATA_DIR, file), toJson(data[key]));
    await writeFile(path.join(DATA_DIR, REPORT_FILE), toJson({ updatedAt: new Date().toISOString(), stats, issues }));
  }

  const summary = printSummary(stats, issues, changed, dryRun);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `### Sincronización de la planilla\n\n${summary.map((l) => `- ${l}`).join('\n')}\n`, { flag: 'a' });
  }
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `changed=${changed && !dryRun}\n`, { flag: 'a' });
  }
}

main().catch((error) => {
  if (error instanceof FatalError) {
    console.error(`\nNo se sincronizó: ${error.message}\nLa web queda como estaba.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
