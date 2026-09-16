// .shared/js/modules/fs.js
//
// the whole filesystem layer, in one module. the mental model is one sentence:
// everything here operates on the File System Access *directory handle*, and the
// only part that is genuinely hard is getting one.
//
// three things implement that handle interface, identically:
//   1. the browser's native FileSystemDirectoryHandle  (showDirectoryPicker)
//   2. the OPFS root                                   (same class, no prompt)
//   3. the Capacitor shim in PLATFORM below            (android SAF, hand-written)
//
// so nothing below the PLATFORM section branches on platform. walking, reading
// and writing are written once against the interface both a real handle and the
// shim expose:
//
//   .kind .name · entries() keys() values() · getDirectoryHandle() getFileHandle()
//   removeEntry() · isSameEntry() · queryPermission() requestPermission()
//   getFile() createWritable()                                    (file handles)
//
// sections, in dependency order — each one only uses the ones above it:
//
//   PLATFORM    pick a folder; persist a root handle across reloads
//   PERMISSION  query / request access to a handle we stored earlier
//   WALK        a handle -> a pruned, sorted tree of file nodes
//   TREE        crud on a handle, addressed by ['seg','ments']
//   SYNC        diff a scan against stored records (syncSource, MetaQueue)
//   LIBRARY     FolderLibrary — the granted-folder lifecycle: signals + db
//   OPFS        the origin's private storage
//
// runtime wiring: every export but `opfs` is spread onto `zugriff.fs`; `opfs` is
// one shared instance per origin, so it hangs off `zugriff.opfs` on its own.

import { signal }     from '@aufbau/signals';
import { createDb }   from '@bunker/db';
import { createPool } from '../vendors/pool.js';

// the file system access api reports both "not there" and "not allowed" by
// throwing, so probing it is nearly always a try/catch. this is that try/catch,
// written once, so the rest of the file reads as plain control flow.
const attempt = async (fn, fallback = null) => {
  try { return await fn(); } catch { return fallback; }
};

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const extOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: PLATFORM
//
// a zugriff app runs off its https origin either in a plain browser or inside
// the Capacitor wrapper (android). exactly two things differ:
//
//   1. picking a folder  — showDirectoryPicker() vs the native SAF picker
//   2. persisting a root — a browser handle is structured-cloneable and round-
//                          trips through IndexedDB as-is; the shim is not, so we
//                          store a plain { uri } descriptor and rebuild from it.
//
// the npm @capacitor/* packages are never bundled into what the webview loads
// (server.url points at the live origin — see the build-capacitor workflow).
// what *is* there is the bridge Capacitor injects as globalThis.Capacitor, with
// every installed plugin under Capacitor.Plugins — so we reach plugins through
// that and keep the import map free of capacitor entries.

/** running inside the native Capacitor wrapper (vs a plain browser)? */
export const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

const plugin = name => {
  const p = globalThis.Capacitor?.Plugins?.[name];
  if (!p) throw new Error(`[fs] the "${name}" Capacitor plugin is not available`);
  return p;
};

const CapFs     = () => plugin('Filesystem');
const CapPicker = () => plugin('FilePicker');   // @capawesome/capacitor-file-picker

// :::::: base64 <-> binary (the plugin speaks base64 for file bodies)

const b64ToArrayBuffer = b64 => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

const arrayBufferToB64 = buffer => {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;   // avoid "too many arguments" on big files
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
};

const toArrayBuffer = async data => {
  if (data instanceof ArrayBuffer)  return data;
  if (ArrayBuffer.isView(data))     return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (data instanceof Blob)         return data.arrayBuffer();
  if (typeof data === 'string')     return new TextEncoder().encode(data).buffer;
  return new Blob([data]).arrayBuffer();
};

// a light ext -> mime map, so the shim's getFile() hands back a typed File where
// that is cheap to know. anything unlisted gets '' — the folder apps sniff their
// own types anyway. the browser sets this itself, so this is shim-only.
const MIME = {
  txt:'text/plain', md:'text/markdown', markdown:'text/markdown', json:'application/json',
  html:'text/html', css:'text/css', js:'text/javascript', csv:'text/csv', xml:'application/xml',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
  svg:'image/svg+xml', avif:'image/avif', bmp:'image/bmp', ico:'image/x-icon', heic:'image/heic',
  pdf:'application/pdf', epub:'application/epub+zip',
  mp3:'audio/mpeg', ogg:'audio/ogg', flac:'audio/flac', m4a:'audio/mp4', wav:'audio/wav',
  mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime',
};
const mimeOf = name => MIME[extOf(name)] ?? '';

// content:// uris cannot be reliably extended by string concatenation, but
// file:// ones can, and that is the only place a joined child uri is used (the
// create paths). readdir returns each child's real uri, so reads never join.
const joinUri = (parent, name) => `${parent.replace(/\/+$/, '')}/${encodeURIComponent(name)}`;

// :::::: THE CAPACITOR HANDLE SHIM
//
// android folder grants come from the Storage Access Framework: a directory is
// picked with the file-picker plugin, which hands back a *persisted* content://
// tree uri — the fix for the File System Access pain on android, where every
// visit otherwise re-prompts. a handle's identity here is its uri. the read path
// (readdir / readFile / stat) drives every folder app; writes on a SAF tree are
// best-effort (see createWritable and getFileHandle).

class CapHandle {
  constructor ({ name, path }) { this.name = name; this.path = path; }
  async isSameEntry       (other) { return other?.path === this.path; }
  async queryPermission   ()      { return 'granted'; }   // the SAF grant persists at pick time
  async requestPermission ()      { return 'granted'; }
}

class CapFileHandle extends CapHandle {
  kind = 'file';

  /** the live File, read fresh from disk — mirrors FileSystemFileHandle.getFile() */
  async getFile () {
    const stat  = await attempt(() => CapFs().stat({ path: this.path }), null);
    const { data } = await CapFs().readFile({ path: this.path });   // base64, no encoding => binary-safe
    const buffer   = b64ToArrayBuffer(typeof data === 'string' ? data : '');
    return new File([buffer], this.name, { type: mimeOf(this.name), lastModified: stat?.mtime ?? Date.now() });
  }

  /**
   * a writable that buffers and flushes once on close, since the plugin has no
   * streaming write. good enough for the small files the apps produce. creating
   * a brand-new file under a SAF content:// tree this way is best-effort;
   * overwriting an existing file (the common case) is reliable.
   */
  async createWritable () {
    const path = this.path, chunks = [];
    return {
      async write (data) { chunks.push(await toArrayBuffer(data)); },
      async close () { await CapFs().writeFile({ path, data: arrayBufferToB64(await new Blob(chunks).arrayBuffer()) }); },
      async abort () {},
    };
  }
}

class CapDirHandle extends CapHandle {
  kind = 'directory';

  // recent plugin versions return { name, type, uri, size, mtime }; older ones a
  // bare string name — handle both, falling back to a joined uri when none given.
  async #children () {
    const { files = [] } = await CapFs().readdir({ path: this.path });
    return files.map(f => typeof f === 'string'
      ? { name: f,      kind: 'file',                                        path: joinUri(this.path, f) }
      : { name: f.name, kind: f.type === 'directory' ? 'directory' : 'file', path: f.uri ?? joinUri(this.path, f.name) });
  }

  #handleFor = child => child.kind === 'directory' ? new CapDirHandle(child) : new CapFileHandle(child);

  async *entries () { for (const c of await this.#children()) yield [c.name, this.#handleFor(c)]; }
  async *keys    () { for (const c of await this.#children()) yield c.name; }
  async *values  () { for (const c of await this.#children()) yield this.#handleFor(c); }

  async #child (name, kind, create, make) {
    for (const c of await this.#children()) if (c.name === name && c.kind === kind) return this.#handleFor(c);
    if (!create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const path = joinUri(this.path, name);
    await make(path);
    return this.#handleFor({ name, kind, path });
  }

  getDirectoryHandle (name, { create = false } = {}) {
    return this.#child(name, 'directory', create, path => CapFs().mkdir({ path, recursive: false }));
  }

  getFileHandle (name, { create = false } = {}) {
    return this.#child(name, 'file', create, path => CapFs().writeFile({ path, data: '' }));
  }

  async removeEntry (name, { recursive = false } = {}) {
    for (const c of await this.#children()) if (c.name === name) {
      await (c.kind === 'directory' ? CapFs().rmdir({ path: c.path, recursive }) : CapFs().deleteFile({ path: c.path }));
      return;
    }
    throw new DOMException(`${name} not found`, 'NotFoundError');
  }
}

// name a tree uri for display: decode its last path segment, which for a SAF
// tree uri is the document id (e.g. "primary:Music") — take the part after ':'.
const nameFromUri = uri => {
  try {
    const last = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() || '');
    return last.split(':').pop() || last || 'folder';
  } catch { return 'folder'; }
};

// :::::: THE PUBLIC SEAM

/** can this platform grant a folder at all? */
export const supported = () => isNative() || typeof globalThis.showDirectoryPicker === 'function';

/**
 * open the folder picker -> a live directory handle, or null if the user
 * dismissed it. on the web this is showDirectoryPicker and must run inside a
 * user gesture; on native it is the SAF picker, which persists the grant so it
 * survives restarts. either way the result satisfies the handle interface.
 */
export async function pickDirectory ({ id, mode = 'read', startIn } = {}) {
  // only a dismissal becomes null — a missing plugin or a real SAF failure must
  // still surface, or a broken build looks exactly like a user pressing cancel.
  if (isNative()) {
    let res;
    try { res = await CapPicker().pickDirectory(); }   // persists the grant on android
    catch (error) {
      if (/cancel/i.test(error?.message || '')) return null;
      throw error;
    }
    const uri = res?.path ?? res?.uri;
    return uri ? new CapDirHandle({ name: nameFromUri(uri), path: uri }) : null;
  }

  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try { return await globalThis.showDirectoryPicker({ id, mode, startIn }); }
  catch (error) {
    if (error?.name === 'AbortError') return null;   // the user dismissed the picker
    throw error;
  }
}

// persistence seam. both key off the *value* (is this a shim handle / a shim
// descriptor?), never off isNative(), so the web path stays a pure identity and
// records written by an earlier build keep loading. the descriptor's wire shape
// ({ __capfs, uri, name }) is what sits in IndexedDB — do not rename its fields.
export const
dehydrate = handle => handle instanceof CapDirHandle ? { __capfs: true, uri: handle.path, name: handle.name } : handle,
hydrate   = ref    => ref?.__capfs === true ? new CapDirHandle({ name: ref.name, path: ref.uri }) : ref;

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: PERMISSION
//
// query never prompts. request must run inside a user gesture (transient
// activation), so call it as the FIRST awaited thing in a click handler — an
// intervening await can consume the activation and make the prompt silently
// reject. request already returns 'granted' without prompting when permission is
// still held, so there is never a need to query first.

/** the current permission state without prompting: 'granted' | 'prompt' | 'denied' */
export async function queryPermission (handle, mode = 'read') {
  if (!handle?.queryPermission) return 'granted';   // no gate on this platform
  return attempt(() => handle.queryPermission({ mode }), 'denied');
}

/**
 * request read (or readwrite) access, reporting exactly what happened so a caller
 * can show the real reason a re-grant failed. returns { granted, state?, error? }
 * — `state` is the raw permission string, `error` is set only if the call threw.
 */
export async function requestRead (handle, mode = 'read') {
  if (!handle?.requestPermission) return { granted: true, state: 'granted' };
  try {
    const state = await handle.requestPermission({ mode });
    return { granted: state === 'granted', state };
  } catch (error) {
    console.warn('[fs] requestPermission threw:', error);
    return { granted: false, error };
  }
}

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: WALK
//
// paths here are forward-slash strings relative to the scanned root, e.g.
// "journal/2026/entry.md"; the root itself is "". that is the path an app stores
// in a record and later walks back down with FolderLibrary#fileHandle.

/**
 * walk `dirHandle` recursively into a tree mirroring the folder structure. only
 * files for which `accept(name)` is true are kept, and a directory with no
 * accepted file anywhere beneath it is pruned — so the tree is exactly the shape
 * of the content, never an empty scaffold. dot-files and dot-folders are skipped.
 *
 *   dir  : { kind:'dir',  name, path, handle, children:[…] }
 *   file : { kind:'file', name, path, ext, handle }
 *
 * children are directories first, then files, each sorted naturally by name.
 */
export async function scanTree (dirHandle, { accept = () => true, signal: abort } = {}) {
  const walk = async (handle, prefix) => {
    const dirs = [], files = [];

    for await (const [name, child] of handle.entries()) {
      if (abort?.aborted) throw new DOMException('scan aborted', 'AbortError');
      if (name.startsWith('.')) continue;
      const path = prefix ? `${prefix}/${name}` : name;

      if (child.kind === 'directory') {
        const node = await walk(child, path);
        if (node.children.length) dirs.push(node);
      } else if (accept(name)) {
        files.push({ kind: 'file', name, path, ext: extOf(name), handle: child });
      }
    }

    dirs.sort(byName); files.sort(byName);
    return { kind: 'dir', name: handle.name, path: prefix, handle, children: [...dirs, ...files] };
  };

  return walk(dirHandle, '');
}

/** every file node in a tree, depth-first, as a flat array */
export function flatten (node, out = []) {
  if (!node) return out;
  if (node.kind === 'file') out.push(node);
  else for (const child of node.children ?? []) flatten(child, out);
  return out;
}

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: TREE
//
// crud on a root handle, addressed by an array of segment names — ['projects',
// 'src'], the root itself being []. that is how a file browser thinks (a cwd
// plus an entry name), which is why it differs from the string paths in WALK.
//
// writes need a writable root: OPFS always is, a granted on-disk folder only if
// it was picked with mode:'readwrite'. the FileExplorer gates its write ui on
// backend.writable, so these are never reached read-only.

/** the directory handle at `path`, walking down from `root` */
export async function dirAt (root, path = []) {
  let dir = root;
  for (const name of path) dir = await dir.getDirectoryHandle(name, { create: false });
  return dir;
}

/** the entries in `path`, directories first then files, each sorted by name */
export async function list (root, path = []) {
  const dir  = await dirAt(root, path);
  const rows = [];

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') { rows.push({ name, kind: 'directory' }); continue; }
    const file = await handle.getFile();
    rows.push({ name, kind: 'file', size: file.size, lastModified: file.lastModified, type: file.type });
  }

  return rows.sort((a, b) => a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : byName(a, b));
}

/** true if `name` already exists in `path`, either kind */
export async function exists (root, path, name) {
  const dir = await dirAt(root, path);
  const hit = await attempt(() => dir.getFileHandle(name)) ?? await attempt(() => dir.getDirectoryHandle(name));
  return hit !== null;
}

export async function mkdir (root, path, name) {
  await (await dirAt(root, path)).getDirectoryHandle(name, { create: true });
}

/** create an empty file — a no-op if it already exists */
export async function touch (root, path, name) {
  await (await dirAt(root, path)).getFileHandle(name, { create: true });
}

/** the File object at path/name */
export async function readFile (root, path, name) {
  const handle = await (await dirAt(root, path)).getFileHandle(name);
  return handle.getFile();
}

/** write `data` (Blob | ArrayBuffer | string) to a file, creating it */
export async function writeFile (root, path, name, data) {
  const handle = await (await dirAt(root, path)).getFileHandle(name, { create: true });
  await writeInto(handle, data);
}

/** remove an entry; directories go recursively */
export async function remove (root, path, name) {
  await (await dirAt(root, path)).removeEntry(name, { recursive: true });
}

const writeInto = async (handle, data) => {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
};

// rename — the handle interface has no move, so a rename is a copy then a
// delete. files copy in one write; directories are walked and rebuilt entry by
// entry.
async function copyDirInto (src, dst) {
  for await (const [name, handle] of src.entries()) {
    if (handle.kind === 'directory') {
      await copyDirInto(handle, await dst.getDirectoryHandle(name, { create: true }));
    } else {
      const file = await handle.getFile();
      await writeInto(await dst.getFileHandle(name, { create: true }), await file.arrayBuffer());
    }
  }
}

export async function rename (root, path, from, to, kind) {
  const dir = await dirAt(root, path);

  if (kind === 'directory') {
    await copyDirInto(await dir.getDirectoryHandle(from), await dir.getDirectoryHandle(to, { create: true }));
  } else {
    const file = await (await dir.getFileHandle(from)).getFile();
    await writeInto(await dir.getFileHandle(to, { create: true }), await file.arrayBuffer());
  }

  await dir.removeEntry(from, { recursive: true });
}

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: SYNC
//
// the two reusable pieces of a "scan a granted folder into records" pass. notes
// needs neither (it just keeps the tree), so FolderLibrary takes a plain `scan`
// callback and these stay opt-in.

/** the size+mtime signature that tells whether a file changed since the last scan */
export const signatureOf = file => `${file.size}:${file.lastModified}`;

/**
 * reconcile `rows` (every record across all sources) with the `files` found in
 * one source's folder, and persist the difference to `store`.
 *
 *   db          the @bunker/db instance
 *   store       object-store name the records live in (e.g. 'tracks', 'books')
 *   sourceId    the source being scanned
 *   files       flat file nodes from flatten(await scanTree(...))
 *   rows        the current full array of records (from the app's signal)
 *   keyOf       (sourceId, path) => key
 *   makeRecord  (fileNode, { key, sourceId, sig, prev }) => a fresh record,
 *               called only for a new or changed file
 *
 * returns the next full array of records (this source rebuilt, others untouched),
 * ready to assign straight to the app's signal.
 */
export async function syncSource ({ db, store, sourceId, files, rows, keyOf, makeRecord }) {
  const seen    = new Set;
  const known   = new Map(rows.map(r => [r.key, r]));
  const next    = rows.filter(r => r.sourceId !== sourceId);   // rebuild this source's rows
  const toWrite = [];

  for (const f of files) {
    const key = keyOf(sourceId, f.path);
    seen.add(key);
    const sig  = signatureOf(await f.handle.getFile());   // cheap: metadata only
    const prev = known.get(key);

    const rec = prev && prev.sig === sig
      ? prev                                             // unchanged — keep as-is
      : makeRecord(f, { key, sourceId, sig, prev });
    next.push(rec);
    if (rec !== prev) toWrite.push(rec);
  }

  const gone = rows.filter(r => r.sourceId === sourceId && !seen.has(r.key)).map(r => r.key);
  if    (gone.length) await db.task(store, 'readwrite', s => { for (const k of gone)    s.delete(k); });
  if (toWrite.length) await db.task(store, 'readwrite', s => { for (const r of toWrite) s.put(r, r.key); });

  return next;
}

/**
 * a bounded background queue keyed by each item's `.key`, so a rescan cannot
 * double-enqueue an item already queued or in flight. `pending` is a signal of
 * how many are still outstanding, for a "reading tags…" indicator.
 *
 *   const meta = new MetaQueue(3);
 *   meta.enqueue(newRows, row => extractOne(row));
 */
export class MetaQueue {
  constructor (concurrency = 3) {
    this.gate    = createPool(concurrency);
    this.queued  = new Set;
    this.pending = signal(0);
  }

  enqueue (items, worker) {
    for (const item of items) {
      if (this.queued.has(item.key)) continue;
      this.queued.add(item.key);
      this.gate(() => worker(item)).finally(() => {
        this.queued.delete(item.key);
        this.pending.value = this.queued.size;
      });
    }
    this.pending.value = this.queued.size;
  }
}

// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: LIBRARY
//
// the shared lifecycle around folders the user grants off their real disk. every
// app that is a live view onto granted folders used to re-implement the same
// dance in its own db.js:
//
//   * keep the granted handles in a @bunker/db store, since a handle survives a
//     reload (see dehydrate/hydrate for why that is not quite free on android)
//   * on load, resolve each handle's permission (never prompts) before showing
//     the ui, then rescan the granted ones in the background
//   * add / reconnect / re-pick / forget a folder, keeping signals and db in step
//
// this class owns exactly that. what a scan *produces* — a tree, tagged tracks,
// book covers — is app-specific, so the app passes a `scan` callback (plus, if it
// keeps its own record stores, an `onLoad` to hydrate them and a `cascade` to
// drop them when a source is removed). the shared @bunker/db instance is `.db`.
//
// two shapes:
//   multi  (default)        an array of granted folders — sources / perms / scanning
//   single { single:true }  one granted root — folder / perm  (the files app)
//
// used by: notes, ebooks, audio-manager, images, videos, files.

// a granted root is kept live (a directory handle) in the signals, but persisted
// as whatever survives IndexedDB: on the web the handle itself, on a Capacitor
// build a plain descriptor. dehydrate on every write, hydrate on every read — so
// the in-memory `handle` is always a live handle.
const persist   = rec => ({ ...rec, handle: dehydrate(rec.handle) });
const rehydrate = rec => rec && { ...rec, handle: hydrate(rec.handle) };

export class FolderLibrary {
  /**
   * @param {object}   opts
   * @param {string}   opts.db        @bunker/db database name (e.g. 'zugriff-notes')
   * @param {string}   opts.pickerId  showDirectoryPicker id (stable "start here" slot)
   * @param {object}   opts.stores    db.setup schema, e.g. { sources: {}, books: {} }
   * @param {boolean} [opts.single]   single-root mode (one folder, no array)
   * @param {function}[opts.scan]     async (source, ctx) => void — multi mode
   * @param {function}[opts.onLoad]   async (db) => void — hydrate app-owned signals after load
   * @param {function}[opts.cascade]  async (id, db) => void — drop app records for a removed source
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
    ]) this[m] = this[m].bind(this);
  }

  #pick () { return pickDirectory({ id: this.pickerId, mode: 'read' }); }

  // ── loading ──────────────────────────────────────────────────────────────

  static #ROOT = 'root';   // the one key single-mode stores its folder under

  async load () {
    await this.db.setup(this.stores);
    if (this.single) return this.#loadSingle();

    const [srcRows] = await Promise.all([
      this.db.getAll('sources'),
      this._onLoad ? this._onLoad(this.db) : null,   // hydrate app-owned stores
    ]);
    this.sources.value = Object.values(srcRows).map(rehydrate).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    // resolve permissions first (fast, never prompts) so the ui never flashes a
    // spurious "reconnect", reveal it, then rescan granted folders in the background
    await Promise.all(this.sources.value.map(async s => {
      this.perms.value = { ...this.perms.value, [s.id]: await queryPermission(s.handle, 'read') };
    }));
    this.ready.value = true;

    this.sources.value.forEach(s => {
      if (this.perms.value[s.id] === 'granted') this.scan(s.id).catch(() => {});
    });
  }

  async #loadSingle () {
    const rec = rehydrate(await this.db.get('root', FolderLibrary.#ROOT));
    if (rec) {
      this.folder.value = rec;
      this.perm.value   = await queryPermission(rec.handle, 'read');   // never prompts
    }
    this.ready.value = true;
  }

  // ── single-root mode ─────────────────────────────────────────────────────

  /** pick a folder to browse (also the "change folder" path). must run from a click. */
  async grant () {
    const handle = await this.#pick();
    if (!handle) return null;
    const rec = { name: handle.name, handle, addedAt: Date.now() };
    await this.db.set('root', FolderLibrary.#ROOT, persist(rec));
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

  // ── multi-source mode ────────────────────────────────────────────────────

  sourceById (id) { return this.sources.value.find(s => s.id === id) ?? null; }

  /** grant a new folder. returns the record, or null if the picker was dismissed. */
  async addFolder () {
    const handle = await this.#pick();
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
      const res = await requestRead(rec.handle, 'read');
      this.perm.value = res.granted ? 'granted' : (res.state ?? 'denied');
      return res;
    }

    const s = this.sourceById(id);
    if (!s) return { granted: false };
    const res = await requestRead(s.handle, 'read');
    this.perms.value = { ...this.perms.value, [id]: res.granted ? 'granted' : (res.state ?? 'denied') };
    if (res.granted) await this.scan(id);
    return res;
  }

  /**
   * reliable fallback: re-pick the same folder. the picker remembers the location
   * (via the shared pickerId) and always hands back a freshly granted handle, so
   * this works even when reconnect() cannot re-grant the stored one. records are
   * keyed by path, so covers/metadata/progress survive the swap.
   */
  async repick (id) {
    const source = this.sourceById(id); if (!source) return false;
    const handle = await this.#pick();  if (!handle) return false;
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
    const perms = { ...this.perms.value };
    delete perms[id];
    this.perms.value = perms;
  }

  // ── scanning ─────────────────────────────────────────────────────────────

  async scan (id) {
    const s = this.sourceById(id);
    if (!s || !this._scan) return;
    this.scanning.value = { ...this.scanning.value, [id]: true };
    try     { await this._scan(s, { db: this.db, lib: this }); }
    finally { this.scanning.value = { ...this.scanning.value, [id]: false }; }
  }

  rescanAll () {
    return Promise.all(
      this.sources.value
        .filter(s => this.perms.value[s.id] === 'granted')
        .map(s => this.scan(s.id).catch(() => {})),
    );
  }

  // ── file access ──────────────────────────────────────────────────────────
  // walk a stored '/'-path (see WALK) down from a source's root to a live handle.

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

// ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: OPFS
//
// the private Origin Private File System — storage the origin owns outright,
// with no picker and no permission prompt. there is exactly one per origin, so
// this exports a single shared instance and the runtime hangs it off
// `zugriff.opfs`, not under `zugriff.fs`.
//
// the flat api below (filename only) is all the cli needs. anything that walks a
// tree uses the TREE section on top of `opfs.root` instead — `opfs.backend`
// hands that root to the FileExplorer component, so the same tree ui browses
// OPFS and granted folders alike.

export class OPFS {
  root = null;

  /** connect to the browser OPFS root (lazy, once) */
  async init () {
    if (!OPFS.supported()) throw new Error('OPFS is not supported in this browser environment.');
    return this.root ??= await globalThis.navigator.storage.getDirectory();
  }

  static supported = () => typeof globalThis.navigator?.storage?.getDirectory === 'function';

  /** { usage, quota } in bytes for the origin's storage, best-effort */
  static async usage () {
    const { usage = 0, quota = 0 } = await globalThis.navigator?.storage?.estimate?.() ?? {};
    return { usage, quota };
  }

  /** list the files in the flat root */
  async listFiles () {
    const root  = await this.init();
    const files = [];
    for await (const [name, handle] of root.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await handle.getFile();
      files.push({ name, size: file.size, lastModified: file.lastModified });
    }
    return files;
  }

  /** write a file buffer */
  async writeFile (filename, data) {
    const root = await this.init();
    await writeInto(await root.getFileHandle(filename, { create: true }), data);
  }

  /** read a file as ArrayBuffer */
  async readFile (filename) {
    const root   = await this.init();
    const handle = await root.getFileHandle(filename);
    return (await handle.getFile()).arrayBuffer();
  }

  /** remove a file */
  async removeFile (filename) {
    const root = await this.init();
    await root.removeEntry(filename);
  }
}

export const opfs = new OPFS;

/**
 * a FileExplorer backend over OPFS. a backend hands the component a root and
 * says what it can do: { id, label, writable, supported(), getRoot(), usage?() }.
 * drop `<${FileExplorer} backend=${zugriff.opfs.backend} />` into any app.
 */
opfs.backend = {
  id        : 'opfs',
  label     : 'private storage',
  writable  : true,
  supported : OPFS.supported,
  getRoot   : () => opfs.init(),
  usage     : OPFS.usage,
};
