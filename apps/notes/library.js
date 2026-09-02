// apps/notes/library.js
//
// notes is a live view onto folders the user grants: the only durable state is the
// set of granted directory handles, and the folder lifecycle around them is the
// shared FolderLibrary (shared/js/filesystem/folders.js). the one app-owned bit is
// the scanned tree per source — everything shown on screen (the tree, a note's
// text) is read straight from disk on demand and never copied into a store.
//
// the built instance is extended with the app-specific surface (trees, accept,
// readNote, fs) and exported whole; app.js binds it to the app handle, so the app
// code reaches it as `app.lib`.

import { signal }  from '@aufbau/kits/preact-htm';
import { zugriff } from '/.shared/js/runtime.js';
import * as fs     from '/.shared/js/filesystem/fsaccess.js';

// what counts as a note. markdown and its usual spellings; a folder full of
// anything else simply scans to nothing.
const MD = /\.(md|markdown|mdown|mkd|mdwn|mdtxt)$/i;
const accept = name => MD.test(name);

// sourceId -> scanned tree node | null
const trees = signal({});

const lib = new zugriff.fs.FolderLibrary({
  db:       'zugriff-notes',
  pickerId: 'zugriff-notes',
  stores:   { sources: {} },

  // a scan just (re)builds this source's tree; on a lost grant, flip it back to
  // "prompt" and surface the error on the node, then rethrow (rescanAll swallows)
  scan: async (s, { lib }) => {
    try {
      const tree = await fs.scanTree(s.handle, { accept });
      trees.value = { ...trees.value, [s.id]: tree };
    } catch (err) {
      if (err?.name === 'NotAllowedError') lib.perms.value = { ...lib.perms.value, [s.id]: 'prompt' };
      trees.value = { ...trees.value, [s.id]: { ...(trees.value[s.id]), error: err.message } };
      throw err;
    }
  },

  // drop the source's tree when the folder is forgotten
  cascade: (id) => {
    const t = { ...trees.value }; delete t[id]; trees.value = t;
  },
});

// :::::: EXTEND
// hang the app-facing surface straight off the instance; FolderLibrary already
// carries sources / perms / scanning / ready / sourceById / load / addFolder /
// reconnect / repick / removeFolder / scan / rescanAll.

lib.fs     = fs;
lib.accept = accept;
lib.trees  = trees;

/** the text of one note file */
lib.readNote = async (fileHandle) => {
  const file = await fileHandle.getFile();
  return { text: await file.text(), lastModified: file.lastModified, size: file.size };
};

export { lib };
export default lib;
