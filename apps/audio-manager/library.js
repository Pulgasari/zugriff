// apps/audio-manager/library.js
//
// pulling tags + cover art out of an audio file. music-metadata reads id3
// (mp3), vorbis comments (ogg/flac), mp4 atoms (m4a) and more; the cover is
// downscaled and re-encoded so a big library doesn't bloat IndexedDB. this is
// the slow part of a scan, so db.js runs it through a bounded pool and caches
// the result keyed by the file's size+mtime signature.

import { parseBlob } from 'music-metadata';

export const EXT    = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|wma|aiff?)$/i;
export const accept = name => EXT.test(name);

const COVER_MAX = 400;   // longest cover edge we keep, px

// a readable fallback title/artist from a filename
export function prettyName (name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function downscale (blob) {
  try {
    const bmp   = await createImageBitmap(blob);
    const scale = Math.min(1, COVER_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return (await new Promise(res => canvas.toBlob(res, 'image/webp', 0.82))) || blob;
  } catch { return blob; }
}

const firstGenre = g => Array.isArray(g) ? g[0] : g;

/** { title, artist, album, albumArtist, trackNo, year, genre, duration, cover } */
export async function extractMeta (file) {
  const { common = {}, format = {} } = await parseBlob(file, { duration: true }).catch(() => ({}));

  let cover = null;
  const pic = common.picture?.[0];
  if (pic?.data) {
    try { cover = await downscale(new Blob([pic.data], { type: pic.format || 'image/jpeg' })); } catch {}
  }

  return {
    title       : (common.title || '').trim(),
    artist      : (common.artist || '').trim(),
    album       : (common.album || '').trim(),
    albumArtist : (common.albumartist || common.artist || '').trim(),
    trackNo     : common.track?.no ?? null,
    year        : common.year ?? null,
    genre       : (firstGenre(common.genre) || '').trim(),
    duration    : Number.isFinite(format.duration) ? format.duration : null,
    cover,
  };
}
