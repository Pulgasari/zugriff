// apps/images/library.js
//
// the folder-library data layer for the library route. it leans on the shared
// FolderLibrary (zugriff.fs.FolderLibrary), which owns the whole granted-folder
// lifecycle (persisting handles in @bunker/db, resolving perms, add / reconnect /
// re-pick / forget) and calls back here only to turn a scanned folder into image
// records. the built instance is extended with the app-specific surface (pics,
// accept, ensureLoaded, openFile, fs) and exported whole; context.js binds it to
// the app handle, so the app code reaches it as `app.lib`. no covers: an image is
// its own thumbnail, generated lazily in the ui.

import { signal }     from '@aufbau/kits/preact-htm';
import { zugriff }    from '/.shared/js/runtime.js';
import { syncSource } from '/.shared/js/filesystem/scan.js';
import * as fs        from '/.shared/js/filesystem/fsaccess.js';

const IMAGE_RE = /\.(png|jpe?g|jfif|gif|webp|avif|bmp|svg|ico|heic|heif|tiff?)$/i;
const accept = name => IMAGE_RE.test(name);

const SEP   = '/';
const keyOf = (sourceId, path) => sourceId + SEP + path;

// [{ key, sourceId, path, name, ext, sig, addedAt }]
const pics = signal([]);

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

// :::::: EXTEND
// hang the app-facing surface straight off the instance; FolderLibrary already
// carries sources / perms / scanning / ready / addFolder / reconnect / … so the
// whole data layer is reachable through one object.

lib.fs       = fs;
lib.accept   = accept;
lib.pics     = pics;
lib.picByKey = key => pics.value.find(p => p.key === key) ?? null;

// call load() at most once — the first time the library route is shown
let started = false;
lib.ensureLoaded = () => {
  if (started) return;
  started = true;
  lib.load().catch(err => console.warn('[images] library load failed:', err));
};

/** the live File for an image record, opened fresh from its granted folder */
lib.openFile = async (pic) => {
  const source = lib.sourceById(pic.sourceId);
  if (!source) throw new Error('This image’s folder is no longer open.');
  // this runs after a click, inside an effect — no user gesture to prompt with,
  // so if the folder isn't already granted, send them back to reconnect it
  if (await fs.queryPermission(source.handle, 'read') !== 'granted') {
    lib.perms.value = { ...lib.perms.value, [source.id]: 'prompt' };
    throw new Error('Reconnect this folder in the library first.');
  }
  return lib.fileAt(source, pic.path);
};

export { lib };
export default lib;
