// shared/js/filesystem/cap-fs.js
//
// the Capacitor side of the filesystem seam — the native counterpart to a
// browser FileSystemDirectoryHandle. everything downstream (dirfs.js, scanTree,
// FolderLibrary, syncSource, the code + files apps) is written against the
// File System Access *handle interface*: getDirectoryHandle / getFileHandle /
// entries / values / getFile / createWritable / removeEntry / isSameEntry /
// queryPermission / requestPermission / .kind / .name. so instead of forking all
// of that per platform, we implement one pair of shim classes here that speak the
// exact same interface but are backed by the native @capacitor/filesystem plugin.
// then nothing downstream needs to know which platform it is on.
//
// why the plugin is reached through the bridge, not imported: a zugriff app runs
// off its live https origin even inside the Capacitor wrapper (server.url points
// at zugriff.dev — see the build-capacitor workflow), so the npm @capacitor/*
// packages are never bundled into what the webview loads. what *is* there is the
// native bridge Capacitor injects as globalThis.Capacitor, with every installed
// plugin auto-registered under Capacitor.Plugins. so we call those directly and
// keep the web import map free of capacitor entries.
//
// android folder grants come from the Storage Access Framework: a directory is
// picked with the file-picker plugin, which hands back a *persisted* content://
// tree URI. that persisted grant is exactly what fixes the pain the browser File
// System Access API causes on android (a fresh confirmation every visit) — the
// URI keeps working across app restarts, so re-granting is silent.
//
// a handle's identity here is its URI (a content:// or file:// string). the read
// path (readdir / readFile / stat) is robust and drives every folder app (notes,
// ebooks, audio-manager, files — all read-only). writes on a SAF tree are
// best-effort (see createWritable / getFileHandle below).

// ── the bridge ─────────────────────────────────────────────────────────────

export const isCapacitor = () => !!globalThis.Capacitor?.isNativePlatform?.();

const plugin = name => {
  const p = globalThis.Capacitor?.Plugins?.[name];
  if (!p) throw new Error(`[cap-fs] the "${name}" Capacitor plugin is not available`);
  return p;
};

const Filesystem = () => plugin('Filesystem');
const FilePicker = () => plugin('FilePicker');   // @capawesome/capacitor-file-picker

// ── base64 <-> binary (the plugin speaks base64 for file bodies) ─────────────

function b64ToArrayBuffer (b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function arrayBufferToB64 (buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;   // avoid "too many arguments" on big files
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function toArrayBuffer (data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data))    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (data instanceof Blob)        return data.arrayBuffer();
  if (typeof data === 'string')    return new TextEncoder().encode(data).buffer;
  return new Blob([data]).arrayBuffer();
}

// a light ext -> mime map so getFile() hands back a typed File where it is cheap
// to know; anything unlisted gets '' (the folder apps sniff their own types).
const MIME = {
  txt:'text/plain', md:'text/markdown', markdown:'text/markdown', json:'application/json',
  html:'text/html', css:'text/css', js:'text/javascript', csv:'text/csv', xml:'application/xml',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
  svg:'image/svg+xml', avif:'image/avif', bmp:'image/bmp', ico:'image/x-icon', heic:'image/heic',
  pdf:'application/pdf', epub:'application/epub+zip',
  mp3:'audio/mpeg', ogg:'audio/ogg', flac:'audio/flac', m4a:'audio/mp4', wav:'audio/wav',
  mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime',
};
const mimeOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? (MIME[name.slice(dot + 1).toLowerCase()] ?? '') : '';
};

// content:// URIs cannot be reliably extended by string concatenation, but
// file:// ones can, and that is the only place a joined child URI is used (create
// paths). readdir returns each child's real URI, so the read path never joins.
const joinUri = (parent, name) => `${parent.replace(/\/+$/, '')}/${encodeURIComponent(name)}`;

// ── file handle ──────────────────────────────────────────────────────────────

export class CapFileHandle {
  kind = 'file';
  constructor (uri, name) { this._uri = uri; this.name = name; }

  /** the live File, read fresh from disk — mirrors FileSystemFileHandle.getFile() */
  async getFile () {
    let mtime = Date.now(), size;
    try { const st = await Filesystem().stat({ path: this._uri }); mtime = st.mtime ?? mtime; size = st.size; } catch {}
    const { data } = await Filesystem().readFile({ path: this._uri });   // base64, no encoding => binary-safe
    const buf = b64ToArrayBuffer(typeof data === 'string' ? data : '');
    return new File([buf], this.name, { type: mimeOf(this.name), lastModified: mtime });
  }

  /**
   * a writable that buffers writes and flushes once on close, since the plugin
   * has no streaming write. good enough for the small files the apps produce.
   * NOTE: creating a brand-new file under a SAF content:// tree this way is
   * best-effort — overwriting an existing file (the common case) is reliable.
   */
  async createWritable () {
    const uri = this._uri; const chunks = [];
    return {
      async write (data) { chunks.push(await toArrayBuffer(data)); },
      async close () {
        const buf = await new Blob(chunks).arrayBuffer();
        await Filesystem().writeFile({ path: uri, data: arrayBufferToB64(buf) });
      },
      async abort () {},
    };
  }

  async isSameEntry (other)      { return other?._uri === this._uri; }
  async queryPermission ()       { return 'granted'; }   // the SAF grant is persisted at pick time
  async requestPermission ()     { return 'granted'; }
}

// ── directory handle ─────────────────────────────────────────────────────────

export class CapDirHandle {
  kind = 'directory';
  constructor (uri, name) { this._uri = uri; this.name = name; }

  async #children () {
    const { files = [] } = await Filesystem().readdir({ path: this._uri });
    // recent plugin versions return {name,type,uri,size,mtime}; older ones a bare
    // string name — handle both, falling back to a joined URI when none is given.
    return files.map(f => typeof f === 'string'
      ? { name: f, kind: 'file', uri: joinUri(this._uri, f) }
      : { name: f.name, kind: f.type === 'directory' ? 'directory' : 'file', uri: f.uri ?? joinUri(this._uri, f.name) });
  }

  async *entries () {
    for (const c of await this.#children()) {
      yield [c.name, c.kind === 'directory' ? new CapDirHandle(c.uri, c.name) : new CapFileHandle(c.uri, c.name)];
    }
  }

  async *values () { for await (const [, h] of this.entries()) yield h; }
  async *keys ()   { for (const c of await this.#children()) yield c.name; }

  async getDirectoryHandle (name, { create = false } = {}) {
    for (const c of await this.#children())
      if (c.name === name && c.kind === 'directory') return new CapDirHandle(c.uri, c.name);
    if (!create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const uri = joinUri(this._uri, name);
    await Filesystem().mkdir({ path: uri, recursive: false });
    return new CapDirHandle(uri, name);
  }

  async getFileHandle (name, { create = false } = {}) {
    for (const c of await this.#children())
      if (c.name === name && c.kind === 'file') return new CapFileHandle(c.uri, c.name);
    if (!create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const uri = joinUri(this._uri, name);
    await Filesystem().writeFile({ path: uri, data: '' });
    return new CapFileHandle(uri, name);
  }

  async removeEntry (name, { recursive = false } = {}) {
    for (const c of await this.#children()) if (c.name === name) {
      if (c.kind === 'directory') await Filesystem().rmdir({ path: c.uri, recursive });
      else                        await Filesystem().deleteFile({ path: c.uri });
      return;
    }
    throw new DOMException(`${name} not found`, 'NotFoundError');
  }

  async isSameEntry (other)  { return other?._uri === this._uri; }
  async queryPermission ()   { return 'granted'; }
  async requestPermission () { return 'granted'; }
}

// ── picking ──────────────────────────────────────────────────────────────────

// name a tree URI for display: decode its last path segment, which for a SAF
// tree URI is the document id (e.g. "primary:Music") — take the part after ':'.
function nameFromUri (uri) {
  try {
    const last = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() || '');
    const tail = last.split(':').pop();
    return tail || last || 'folder';
  } catch { return 'folder'; }
}

/** open the native SAF directory picker → a live CapDirHandle, or null if cancelled */
export async function pickDirectory () {
  try {
    const res = await FilePicker().pickDirectory();          // persists the grant on android
    const uri = res?.path ?? res?.uri;
    if (!uri) return null;
    return new CapDirHandle(uri, nameFromUri(uri));
  } catch (err) {
    // the picker throws / rejects on user cancel — normalise that to null
    if (/cancel/i.test(err?.message || '')) return null;
    throw err;
  }
}

/** rebuild a live handle from what dehydrate() persisted */
export const hydrate = ref => new CapDirHandle(ref.uri, ref.name);

/** the structured-cloneable descriptor we store for a CapDirHandle */
export const dehydrate = handle => ({ __capfs: true, uri: handle._uri, name: handle.name });
