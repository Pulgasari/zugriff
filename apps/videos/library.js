// apps/videos/library.js
//
// the folder-library data layer for the library route. like images/library.js it
// leans on the shared FolderLibrary (zugriff.fs.FolderLibrary) — which owns the
// granted-folder lifecycle (persisting handles in @bunker/db, resolving perms,
// add / reconnect / re-pick / forget) — and calls back here only to turn a scanned
// folder into clip records. the built instance is extended with the app-specific
// surface (clips, accept, ensureLoaded, openFile, fs) and exported whole; context.js
// binds it to the app handle, so the app code reaches it as `app.lib`. no covers
// yet: a clip is shown as an icon in the ui.

import { signal }     from '@aufbau/kits/preact-htm';
import { zugriff }    from '/.shared/js/runtime.js';
import { syncSource } from '/.shared/js/filesystem/scan.js';
import * as fs        from '/.shared/js/filesystem/fsaccess.js';

const VIDEO_RE = /\.(mp4|m4v|webm|mov|mkv|avi|ogv|ogg|3gp|flv|wmv|mpe?g|ts)$/i;
const accept = name => VIDEO_RE.test(name);

const SEP   = '/';
const keyOf = (sourceId, path) => sourceId + SEP + path;

// [{ key, sourceId, path, name, ext, sig, addedAt }]
const clips = signal([]);

const lib = new zugriff.fs.FolderLibrary({
  db:       'zugriff-videos',
  pickerId: 'zugriff-videos',
  stores:   { sources: {}, clips: {} },

  onLoad: async (db) => { clips.value = Object.values(await db.getAll('clips')); },

  scan: async (s, { db }) => {
    const files = fs.flatten(await fs.scanTree(s.handle, { accept }));
    clips.value = await syncSource({
      db, store: 'clips', sourceId: s.id, files, rows: clips.value, keyOf,
      makeRecord: (f, { key, sourceId, sig, prev }) => ({
        key, sourceId, path: f.path, name: f.name, ext: f.ext,
        sig, addedAt: prev?.addedAt ?? Date.now(),
      }),
    });
  },

  cascade: async (id, db) => {
    const doomed = clips.value.filter(c => c.sourceId === id).map(c => c.key);
    await db.task('clips', 'readwrite', store => { for (const k of doomed) store.delete(k); });
    clips.value = clips.value.filter(c => c.sourceId !== id);
  },
});

// :::::: EXTEND
// hang the app-facing surface straight off the instance; FolderLibrary already
// carries sources / perms / scanning / ready / addFolder / reconnect / … so the
// whole data layer is reachable through one object.

lib.fs        = fs;
lib.accept    = accept;
lib.clips     = clips;
lib.clipByKey = key => clips.value.find(c => c.key === key) ?? null;

// call load() at most once — the first time the library route is shown
let started = false;
lib.ensureLoaded = () => {
  if (started) return;
  started = true;
  lib.load().catch(err => console.warn('[videos] library load failed:', err));
};

/** the live File for a clip record, opened fresh from its granted folder */
lib.openFile = async (clip) => {
  const source = lib.sourceById(clip.sourceId);
  if (!source) throw new Error('This clip’s folder is no longer open.');
  // this runs after a click, inside an effect — no user gesture to prompt with,
  // so if the folder isn't already granted, send them back to reconnect it
  if (await fs.queryPermission(source.handle, 'read') !== 'granted') {
    lib.perms.value = { ...lib.perms.value, [source.id]: 'prompt' };
    throw new Error('Reconnect this folder in the library first.');
  }
  return lib.fileAt(source, clip.path);
};

export { lib };
export default lib;
