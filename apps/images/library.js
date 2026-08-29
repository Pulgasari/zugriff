// apps/images/library.js
//
// the folder-library data layer for the library mode. it leans on the shared
// FolderLibrary (zugriff.fs.FolderLibrary), which owns the whole granted-folder
// lifecycle — persisting the directory handles in @bunker/db, resolving their
// permission on load, add / reconnect / re-pick / forget — and calls back here
// only to turn a scanned folder into image records. no metadata, no covers: an
// image is its own thumbnail, generated lazily in the ui.

import { signal } from '@aufbau/kits/preact-htm';
import { zugriff }    from '/.shared/js/runtime.js';
import { syncSource } from '/.shared/js/filesystem/scan.js';
import * as fs        from '/.shared/js/filesystem/fsaccess.js';

const IMAGE_RE = /\.(png|jpe?g|jfif|gif|webp|avif|bmp|svg|ico|heic|heif|tiff?)$/i;
export const accept = name => IMAGE_RE.test(name);

const SEP   = '/';
const keyOf = (sourceId, path) => sourceId + SEP + path;

// [{ key, sourceId, path, name, ext, sig, addedAt }]
export const pics = signal([]);

export const picByKey = key => pics.value.find(p => p.key === key) ?? null;

const lib = new zugriff.fs.FolderLibrary({
  db:       'zugriff-images',
  pickerId: 'zugriff-images',
  stores:   { sources: {}, pics: {} },

  onLoad: async (db) => { pics.value = Object.values(await db.getAll('pics')); },

  scan: async (s, { db }) => {
    const files = fs.flatten(await fs.scanTree(s.handle, { accept }));
    pics.value = await syncSource({
      db, store: 'pics', sourceId: s.id, files, rows: pics.value, keyOf,
      makeRecord: (f, { key, sourceId, sig, prev }) => ({
        key, sourceId, path: f.path, name: f.name, ext: f.ext,
        sig, addedAt: prev?.addedAt ?? Date.now(),
      }),
    });
  },

  cascade: async (id, db) => {
    const doomed = pics.value.filter(p => p.sourceId === id).map(p => p.key);
    await db.task('pics', 'readwrite', store => { for (const k of doomed) store.delete(k); });
    pics.value = pics.value.filter(p => p.sourceId !== id);
  },
});

export const { sources, perms, scanning, ready } = lib;
export const sourceById   = lib.sourceById;
export const addFolder    = lib.addFolder;
export const reconnect    = lib.reconnect;
export const repick       = lib.repick;
export const removeFolder = lib.removeFolder;
export const rescanAll    = lib.rescanAll;

// call load() at most once — the first time the library mode is shown
let started = false;
export function ensureLoaded () {
  if (started) return;
  started = true;
  lib.load().catch(err => console.warn('[images] library load failed:', err));
}

/** the live File for an image record, opened fresh from its granted folder */
export async function openFile (pic) {
  const source = lib.sourceById(pic.sourceId);
  if (!source) throw new Error('This image’s folder is no longer open.');
  // this runs after a click, inside an effect — no user gesture to prompt with,
  // so if the folder isn't already granted, send them back to reconnect it
  if (await fs.queryPermission(source.handle, 'read') !== 'granted') {
    lib.perms.value = { ...lib.perms.value, [source.id]: 'prompt' };
    throw new Error('Reconnect this folder in the library first.');
  }
  return lib.fileAt(source, pic.path);
}

export { fs };
