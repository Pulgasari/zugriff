// .shared/js/modules/filesystem/folders.js

import { signal }     from '@aufbau/signals';
import { createDb }   from '@bunker/db';
import { createPool } from './../../vendors/pool.js';

const persist   = rec =>        ({ ...rec, handle: zugriff.fs.dehydrate(rec.handle) });
const rehydrate = rec => rec && ({ ...rec, handle: zugriff.fs.  hydrate(rec.handle) });

export class FolderLibrary {
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
    }
    else {
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

  // ── single-root mode ─────────────────────────────────────────────────────

  static #ROOT = 'root';   // the one key single-mode stores its folder under

  async #loadSingle () {
    await this.db.setup(this.stores);
    const rec = rehydrate(await this.db.get('root', FolderLibrary.#ROOT));
    if (rec) {
      this.folder.value = rec;
      this.perm.value   = await handles.queryPermission(rec.handle, 'read');   // never prompts
    }
    this.ready.value = true;
  }

  async grant () {
    const handle = await platform.pickDirectory({ id: this.pickerId, mode: 'read' });
    if (!handle) return null;
    const rec = { name: handle.name, handle, addedAt: Date.now() };
    await this.db.set('root', FolderLibrary.#ROOT, persist(rec));
    this.folder.value = rec;
    this.perm.value   = 'granted';
    return rec;
  }

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
    this.sources.value = Object.values(srcRows).map(rehydrate).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    // resolve permissions first (fast, never prompts) so the ui never flashes a
    // spurious "reconnect", reveal it, then rescan granted folders in the background
    await Promise.all(this.sources.value.map(async s => {
      this.perms.value = { ...this.perms.value, [s.id]: await handles.queryPermission(s.handle, 'read') };
    }));
    this.ready.value = true;

    this.sources.value.forEach(s => {
      if (this.perms.value[s.id] === 'granted') this.scan(s.id).catch(() => {});
    });
  }

  // ── multi-source folders ─────────────────────────────────────────────────

  sourceById (id) { return this.sources.value.find(s => s.id === id) ?? null; }

  async addFolder () {
    const handle = await platform.pickDirectory({ id: this.pickerId, mode: 'read' });
    if (!handle) return null;
    for (const s of this.sources.value) {
      if (await s.handle.isSameEntry?.(handle)) throw new Error('That folder is already in your library.');
    }
    const rec = { id: crypto.randomUUID(), name: handle.name, handle, addedAt: Date.now() };
    await this.db.set('sources', rec.id, persist(rec));
    this.sources.value = [...this.sources.value, rec];
    this.perms.value   = { ...this.perms.value, [rec.id]: 'granted' };
    await this.scan(rec.id);
    return rec;
  }

  async reconnect (id) {
    if (this.single) {
      const rec = this.folder.value; if (!rec) return { granted: false };
      const res = await handles.requestRead(rec.handle, 'read');
      this.perm.value = res.granted ? 'granted' : (res.state ?? 'denied');
      return res;
    }
    
    const s   = this.sourceById(id); if (!s) return { granted: false };
    const res = await handles.requestRead(s.handle, 'read');
    this.perms.value = { ...this.perms.value, [id]: res.granted ? 'granted' : (res.state ?? 'denied') };
    if (res.granted) await this.scan(id);
    return res;
  }

  async repick (id) {
    const source = this.sourceById(id); if (!source) return false;
    const handle = await platform.pickDirectory({ id: this.pickerId, mode: 'read' }); if (!handle) return false;
    const rec    = { ...source, name: handle.name, handle };

    await this.db.set('sources', id, persist(rec));

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

  // ── scanning ─────────────────────────────────────────────────────────────

  async scan (id) {
    const s = this.sourceById(id);
    if (!s) return;
    this.scanning.value = { ...this.scanning.value, [id]: true };
    try {
      if (this._scan) await this._scan(s, { db: this.db, lib: this });
    } finally {
      this.scanning.value = { ...this.scanning.value, [id]: false };
    }
  }

  rescanAll () {
    return Promise.all(
      this.sources.value
        .filter(s => this.perms.value[s.id] === 'granted')
        .map(s => this.scan(s.id).catch(() => {})),
    );
  }

  // ── file access ──────────────────────────────────────────────────────────
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
}

const signatureOf = file => `${file.size}:${file.lastModified}`;

async function syncSource ({ db, store, sourceId, files, rows, keyOf, makeRecord }) {
  const seen    = new Set;
  const known   = new Map(rows.map(r => [r.key, r]));
  const next    = rows.filter(r => r.sourceId !== sourceId);   // rebuild this source's rows
  const toWrite = [];

  for (const f of files) {
    const key  = keyOf(sourceId, f.path);
    seen.add(key);
    const file = await f.handle.getFile();          // cheap: metadata only
    const sig  = signatureOf(file);
    const prev = known.get(key);

    const rec = (prev && prev.sig === sig)
      ? prev                                        // unchanged — keep it as-is
      : makeRecord(f, { key, sourceId, sig, prev });
    next.push(rec);
    if (rec !== prev) toWrite.push(rec);
  }

  // rows for files that vanished from this source
  const gone = rows.filter(r => r.sourceId === sourceId && !seen.has(r.key)).map(r => r.key);
  if    (gone.length) await db.task(store, 'readwrite', s => { for (const k of gone) s.delete(k); });
  if (toWrite.length) await db.task(store, 'readwrite', s => { for (const r of toWrite) s.put(r, r.key); });

  return next;
}

class MetaQueue {
  constructor (concurrency = 3) {
    this.gate    = createPool(concurrency);
    this.queued  = new Set();
    this.pending = signal(0);
  }

  enqueue (items, worker) {
    for (const it of items) {
      if (this.queued.has(it.key)) continue;
      this.queued.add(it.key);
      this.gate(() => worker(it)).finally(() => {
        this.queued.delete(it.key);
        this.pending.value = this.queued.size;
      });
    }
    this.pending.value = this.queued.size;
  }
}

// :::::: EXPORT

export {
  FolderLibrary,
  MetaQueue,
  signatureOf,
  syncSource,
}

export default FolderLibrary
