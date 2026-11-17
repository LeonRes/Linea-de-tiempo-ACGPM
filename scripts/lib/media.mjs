// Interpreta lo que el editor escribe en las columnas `archivo` y `retrato`:
// un nombre de archivo de site/media/, un enlace de Google Drive o una dirección web.

const DRIVE_PATTERNS = [
  /^https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/,
  /^https?:\/\/(?:drive|docs)\.google\.com\/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/,
  /^https?:\/\/drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/,
];

export function classifyRef(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { kind: 'empty' };

  for (const pattern of DRIVE_PATTERNS) {
    const match = value.match(pattern);
    if (match) return { kind: 'drive', id: match[1] };
  }
  if (/^https?:\/\//i.test(value)) {
    try { return { kind: 'url', url: new URL(value).href }; }
    catch { return { kind: 'invalid', reason: 'la dirección web no es válida' }; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return { kind: 'invalid', reason: 'solo se aceptan direcciones que empiecen con http:// o https://' };
  }

  // Nombre de archivo dentro de site/media/
  const name = value.replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/^media\//i, '');
  if (!name || name.split('/').some((part) => part === '..' || part === '')) {
    return { kind: 'invalid', reason: 'el nombre de archivo no es válido' };
  }
  return { kind: 'local', name };
}

// Ruta que usa la web para un archivo de site/media/ (con espacios y acentos codificados).
export function mediaSrc(name) {
  return 'media/' + name.split('/').map(encodeURIComponent).join('/');
}

// Dirección para incrustar un video de YouTube o Vimeo; null si no es de esos sitios.
export function videoEmbed(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  let id = null;

  if (host === 'youtu.be') id = parsed.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
    else {
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      if (match) id = match[1];
    }
  }
  if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/(\d{6,})/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
}

const EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'],
  audio: ['mp3', 'ogg', 'oga', 'm4a', 'wav', 'opus'],
  video: ['mp4', 'webm', 'ogv', 'm4v'],
};

export function hasExtension(name, type) {
  const ext = name.split('.').pop().toLowerCase();
  return EXTENSIONS[type]?.includes(ext) ?? true;
}

export function extensionFromContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'image/svg+xml': 'svg', 'image/avif': 'avif',
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'application/pdf': 'pdf',
  }[type] ?? null;
}
