// apps/images/state.js
// the shared image tray — the open set of images every route works off. view
// browses it, edit loads the current one into a canvas, library opens files into
// it. only setFiles mutates the set; viewer zoom/pan stay in the view route.

import { signal, computed } from '@aufbau/kits/preact-htm';

export const shots   = signal([]);   // [{ name, size, type, file, url }]
export const idx     = signal(0);     // index of the shown image
export const current = computed(() => shots.value[idx.value] ?? null);
export const many    = computed(() => shots.value.length > 1);
export const vError  = signal('');    // the open-set error (bad file, load failure)

const IMAGE_RE = /\.(png|jpe?g|jfif|gif|webp|avif|bmp|svg|ico|heic|heif|tiff?)$/i;
export const isImageFile = f => f && (f.type?.startsWith('image/') || IMAGE_RE.test(f.name || ''));

const UNITS = ['B', 'KB', 'MB', 'GB'];
export function fmtSize (bytes = 0) {
  if (!bytes) return '';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${UNITS[i]}`;
}

export function revokeAll () { for (const s of shots.value) URL.revokeObjectURL(s.url); }

/** replace the open set with these File objects (images only) */
export function setFiles (files) {
  const imgs = [...files].filter(isImageFile);
  if (!imgs.length) {
    if (files.length) vError.value = 'those files aren’t images the browser can show';
    return;
  }
  revokeAll();
  vError.value = '';
  shots.value = imgs.map(f => ({ name: f.name || 'image', size: f.size, type: f.type, url: URL.createObjectURL(f), file: f }));
  idx.value = 0;
}
