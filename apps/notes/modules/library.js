// apps/notes/library.js

import { signal }  from '@aufbau/signals';

// the filesystem layer, uniformly via the runtime
const fs = zugriff.fs;

// what counts as a note. markdown and its usual spellings; a folder full of
// anything else simply scans to nothing.
const MD = /\.(md|markdown|mdown|mkd|mdwn|mdtxt)$/i;
const accept = name => MD.test(name);

// sourceId -> scanned tree node | null. note: the betterSignal factory reads a
// plain object as config, so an initial map value must be wrapped in { value } —
// `signal({})` would leave `.value` undefined, and a read before the first scan
// (e.g. currentNote hydrating from a persisted open) would throw.
const trees = signal({ value: {} });

const lib = new zugriff.fs.FolderLibrary({
  db       : 'zugriff-notes',
  pickerId : 'zugriff-notes',
  stores   : { sources: {} },

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
