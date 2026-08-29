// shared/js/filesystem/folders.js
// zugriff.fs.FolderLibrary
//
// FolderLibrary — the shared lifecycle around folders the user grants us off
// their real disk with the File System Access API. every app that is a live
// view onto granted folders (notes, ebooks, audio-manager, files) used to
// re-implement the same dance in its own db.js:
//
//   * keep the granted directory handles in a @bunker/db store, because a
//     FileSystemDirectoryHandle is structured-cloneable and survives a reload
//   * on load, resolve each handle's permission (never prompts) before showing
//     the ui, then rescan the granted ones in the background
//   * add / reconnect / re-pick / forget a folder, keeping signals and the db
//     in step
//
// this class owns exactly that. what a scan *produces* — a tree, tagged tracks,
// book covers — is app-specific, so the app passes a `scan` callback (and, if it
// keeps its own record stores, an `onLoad` to hydrate them and a `cascade` to
// drop them when a source is removed). the class owns the shared @bunker/db
// instance and exposes it as `.db`.
//
// two shapes:
//   multi  (default)  an array of granted folders — sources / perms / scanning
//   single { single:true }  one granted root — folder / perm  (the files app)
//
// it hangs off the runtime as the constructor `zugriff.fs.FolderLibrary`.

/*
function deleteKeyFromSignalObject(signal, key) {
  const { [key]: _, ...rest } = signal.value;  // destructuring + rest
  signal.value = rest;
}

// oder explizit mit delete (wie im Original)
function deleteKeyFromSignalObject(signal, key) {
  const copy = { ...signal.value };
  delete copy[key];
  signal.value = copy;
}

function setSignalObject(signal, key, value) {
  signal.value = { ...signal.value, [key]: value };
}

// Verwendung:
setSignalObject(this._perms, id, 'granted');
setSignalObject(this._scanning, id, true);

function removeFromSignalObjectListByPredicate(signal, predicate) {
  signal.value = signal.value.filter(item => !predicate(item));
}

// Entfernt Elemente, bei denen ALLE Kriterien erfüllt sind (AND)
function removeFromSignalObjectListByCriteria(signal, criteria) {
  signal.value = signal.value.filter(item =>
    !Object.keys(criteria).every(key => item[key] === criteria[key])
  );
}

// Entfernt Elemente, bei denen MINDESTENS EIN Kriterium erfüllt ist (OR)
function removeFromSignalObjectListByAnyCriteria(signal, criteria) {
  signal.value = signal.value.filter(item =>
    !Object.keys(criteria).some(key => item[key] === criteria[key])
  );
}
*/


import { signal } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
import * as fs from './fsaccess.js';

export class FolderLibrary {
  /**
   * @param {object}  opts
   * @param {string}  opts.db        @bunker/db database name (e.g. 'zugriff-notes')
   * @param {string}  opts.pickerId  showDirectoryPicker id (stable "start here" slot)
   * @param {object}  opts.stores    db.setup schema, e.g. { sources: {}, books: {} }
   * @param {boolean} [opts.single]  single-root mode (one folder, no array)
   * @param {function} [opts.scan]   async (source, ctx) => void — multi mode
   * @param {function} [opts.onLoad] async (db) => void — hydrate app-owned signals after load
   * @param {function} [opts.cascade] async (id, db) => void — drop app records for a removed source
   */
  constructor ({ db, pickerId, stores, single = false, scan, onLoad, cascade } = {}) {
    this.db       = createDb(db);
    this.pickerId = pickerId;
    this.stores   = stores;
    this.single   = single;
    this._scan    = scan;
    this._onLoad  = onLoad;
    this._cascade = cascade;

    this.ready = signal(false);

    if (single) {
      this.folder = signal(null);       // { name, handle, addedAt } | null
      this.perm   = signal('prompt');   // 'granted' | 'prompt' | 'denied'
    } else {
      this.sources  = signal([]);       // [{ id, name, handle, addedAt }]
      this.perms    = signal({});       // id -> permission state
      this.scanning = signal({});       // id -> true while scanning
    }

    // bind the public surface so callers can `export const load = lib.load`
    for (const m of [
      'load', 'sourceById',
      'addFolder', 'reconnect', 'repick', 'removeFolder', 'scan', 'rescanAll',
      'grant', 'forget',
      'fileHandle', 'fileAt',
    ]) if (typeof this[m] === 'function') this[m] = this[m].bind(this);
  }

  // ── single-root mode ───────────────────────────────────────────────────────

  static #ROOT = 'root';   // the one key single-mode stores its folder under

  async #loadSingle () {
    await this.db.setup(this.stores);
    const rec = await this.db.get('root', FolderLibrary.#ROOT);
    if (rec) {
      this.folder.value = rec;
      this.perm.value   = await fs.queryPermission(rec.handle, 'read');   // never prompts
    }
    this.ready.value = true;
  }

  /** pick a folder to browse (also the "change folder" path). must run from a click. */
  async grant () {
    const handle = await fs.pickDirectory({ id: this.pickerId, mode: 'read' });
    if (!handle) return null;
    const rec = { name: handle.name, handle, addedAt: Date.now() };
    await this.db.set('root', FolderLibrary.#ROOT, rec);
    this.folder.value = rec;
    this.perm.value   = 'granted';
    return rec;
  }

  /** forget the single root — drops the handle only, never touches disk. */
  async forget () {
    await this.db.delete('root', FolderLibrary.#ROOT);
    this.folder.value = null;
    this.perm.value   = 'prompt';
  }

  // ── loading ────────────────────────────────────────────────────────────────

  async load () {
    if (this.single) return this.#loadSingle();

    await this.db.setup(this.stores);
    const [srcRows] = await Promise.all([
      this.db.getAll('sources'),
      this._onLoad ? this._onLoad(this.db) : null,   // hydrate app-owned stores
    ]);
    this.sources.value = Object.values(srcRows).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    // resolve permissions first (fast, never prompts) so the ui never flashes a
    // spurious "reconnect", reveal it, then rescan granted folders in the background
    await Promise.all(this.sources.value.map(async s => {
      this.perms.value = { ...this.perms.value, [s.id]: await fs.queryPermission(s.handle, 'read') };
    }));
    this.ready.value = true;

    this.sources.value.forEach(s => {
      if (this.perms.value[s.id] === 'granted') this.scan(s.id).catch(() => {});
    });
  }

  // ── multi-source folders ─────────────────────────────────────────────────

  sourceById (id) { return this.sources.value.find(s => s.id === id) ?? null; }

  /** grant a new folder. returns the record, or null if the picker was dismissed. */
  async addFolder () {
    const handle = await fs.pickDirectory({ id: this.pickerId, mode: 'read' });
    if (!handle) return null;
    for (const s of this.sources.value) {
      if (await s.handle.isSameEntry?.(handle)) throw new Error('That folder is already in your library.');
    }
    const rec = { id: crypto.randomUUID(), name: handle.name, handle, addedAt: Date.now() };
    await this.db.set('sources', rec.id, rec);
    this.sources.value = [...this.sources.value, rec];
    this.perms.value   = { ...this.perms.value, [rec.id]: 'granted' };
    await this.scan(rec.id);
    return rec;
  }
  /*
  async addFolder() {
    const handle = await fs.pickDirectory({ id: this.pickerId, mode: 'read' })
    
    if (!handle) return null;
    if (!this.single && this._entries.value.some(s => s.handle.isSameEntry?.(handle))) throw new Error('...');
    
    const rec = await this.#addEntry(handle);
    await this.scan(rec.id);
    
    return rec;
  }
  */

  /**
   * fast path: re-grant a folder from an earlier session via the stored handle.
   * requestPermission() must run inside the click, so call this straight from the
   * button. browsers are flaky about re-granting a *stored* handle — repick() is
   * the reliable fallback. returns { granted, state?, error? }.
   */
  async reconnect (id) {
    if (this.single) {
      const rec = this.folder.value;
      if (!rec) return { granted: false };
      const res = await fs.requestRead(rec.handle, 'read');
      this.perm.value = res.granted ? 'granted' : (res.state ?? 'denied');
      return res;
    }
    const s = this.sourceById(id);
    if (!s) return { granted: false };
    const res = await fs.requestRead(s.handle, 'read');
    this.perms.value = { ...this.perms.value, [id]: res.granted ? 'granted' : (res.state ?? 'denied') };
    if (res.granted) await this.scan(id);
    return res;
  }

  /**
   * reliable fallback: re-pick the same folder. the picker remembers the location
   * (via the shared id) and always hands back a freshly granted handle, so this
   * works even when reconnect() can't re-grant the stored one. records are keyed
   * by path, so covers/metadata/progress survive the swap.
   */
  async repick (id) {
    const source = this.sourceById(id); if (!source) return false;
    const handle = await fs.pickDirectory({ id: this.pickerId, mode: 'read' }); if (!handle) return false;
    const rec    = { ...source, name: handle.name, handle };
    
    await this.db.set('sources', id, rec);
    
    this.sources.value = this.sources.value.map(x => x.id === id ? rec : x);
    this.perms.value   = { ...this.perms.value, [id]: 'granted' };
    
    await this.scan(id);
    return true;
  }

  /** forget a folder — drops the handle (and, via cascade, its records) only. */
  async removeFolder (id) {
    if (this._cascade) await this._cascade(id, this.db);
    await this.db.delete('sources', id);
    this.sources.value = this.sources.value.filter(s => s.id !== id);
    const pm = { ...this.perms.value };
    delete pm[id]; 
    this.perms.value = pm;
  }

  // ── scanning ───────────────────────────────────────────────────────────────

  async scan (id) {
    const s = this.sourceById(id);
    if (!s) return;
    this.scanning.value = { ...this.scanning.value, [id]: true };
    try {
      if (this._scan) await this._scan(s, { db: this.db, lib: this });
    } finally {
      this.scanning.value = { ...this.scanning.value, [id]: false };
      //updateSignalObj(this.scanning, id, false);
      //this.scanning[id] = false;
    }
  }

  rescanAll () {
    return Promise.all(
      this.sources.value
        .filter(s => this.perms.value[s.id] === 'granted')
        .map(s => this.scan(s.id).catch(() => {})),
    );
  }

  // ── file access ────────────────────────────────────────────────────────────
  // walk a stored '/'-path down from a source's granted root to a live handle.

  async fileHandle (source, path) {
    const parts = path.split('/');
    let dir = source.handle;
    for (const seg of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(seg);
    return dir.getFileHandle(parts.at(-1));
  }

  /** the live File for a stored path, opened fresh from disk */
  async fileAt (source, path) {
    return (await this.fileHandle(source, path)).getFile();
  }

  /*
  async #addEntry (handle) {
    const id  = this.single ? 'root' : crypto.randomUUID();
    const rec = { handle, id, name: handle.name, addedAt: Date.now() };
    
    await this.db.set(this.single ? 'root' : 'sources', id, rec);
    
    this._entries.value = [...this._entries.value, rec];
    this._perms.value   = { ...this._perms.value, [id]: 'granted' };
    
    return rec;
  }
  */
}

export default FolderLibrary;
