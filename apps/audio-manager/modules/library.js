// apps/audio-manager/library.js

import { parseBlob } from 'music-metadata';

const COVER_MAX = 400;
export const EXT    = /\.(mp3|m4a|aac|ogg|oga|opus|flac|wav|wma|aiff?)$/i;
export const accept = name => EXT.test(name);
export const prettyName = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();      

async function downscale (blob) {
  try {
    const bmp   = await createImageBitmap(blob);
    const scale = Math.min(1, COVER_MAX / Math.max(bmp.width, bmp.height));
    const w     = Math.max(1, Math.round(bmp.width * scale));
    const h     = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return (await new Promise(res => canvas.toBlob(res, 'image/webp', 0.82))) || blob;
  } catch { return blob; }
}

const firstGenre = genres => Array.isArray(genres) ? genres[0] : genres;

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
