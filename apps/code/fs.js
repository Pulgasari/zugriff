// apps/code/fs.js
//
// the workspace root — the one FileSystemDirectoryHandle the user grants — is
// the only thing this app keeps between visits. a handle is structured-cloneable
// so it round-trips through IndexedDB (@bunker/db); on the next visit we re-ask
// for permission rather than re-picking. everything shown in the tree and the
// editor is read straight off disk on demand, never copied into the database.
//
// this replaces the old js/fs.js, which spoke to the internal bunker.js build's
// `db.workspace.*` api; here it uses the shared @bunker/db store instead.

import { db, setup } from './db.js';
import * as platform from '/.shared/js/filesystem/platform.js';

const ROOT_ID = 'root-dir';

export const fs = {
  async getSavedRoot () {
    await setup();
    const rec = await db.get('workspace', ROOT_ID);
    return rec ? platform.hydrate(rec) : null;   // web: identity · capacitor: rebuild the shim
  },

  async setRoot (handle) {
    await setup();
    await db.set('workspace', ROOT_ID, platform.dehydrate(handle));   // a shim isn't cloneable — store its descriptor
    return handle;
  },

  async clearRoot () {
    await setup();
    await db.delete('workspace', ROOT_ID);
  },

  async clearAll () {
    await this.clearRoot();
  },

  async ensureReadPermission (handle) {
    let permission = await handle.queryPermission({ mode: 'read' });
    if (permission === 'prompt') permission = await handle.requestPermission({ mode: 'read' });
    return permission === 'granted';
  },

  async ensureWritePermission (handle) {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' });
    return permission === 'granted';
  },

  async readDir (handle) {
    const entries = [];
    for await (const entry of handle.values()) entries.push(entry);
    return entries.sort((a, b) =>
      a.kind === b.kind
        ? a.name.localeCompare(b.name)
        : a.kind === 'directory' ? -1 : 1,
    );
  },
};

export default fs;
