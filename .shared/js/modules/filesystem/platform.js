// .shared/js/modules/filesystem/platform.js
//
// the one place that knows which platform we run on, so the rest of the fs layer
// does not have to. a zugriff app runs off its https origin either in a plain
// browser or inside the Capacitor wrapper (android). two things genuinely differ:
//
//   1. picking a folder   — showDirectoryPicker() vs the native SAF picker
//   2. persisting a root  — a browser handle is structured-cloneable and round-
//                           trips through IndexedDB as-is; a native handle is not,
//                           so we store a plain { uri } descriptor and rebuild it.
//
// everything else (walking, reading, writing) is the shared File System Access
// *handle interface* — getDirectoryHandle / getFileHandle / entries / values /
// getFile / createWritable / removeEntry / isSameEntry / query+requestPermission /
// .kind / .name. the Capacitor shim below implements that exact interface backed
// by the native @capacitor/filesystem plugin, so nothing downstream branches on
// platform: handles.js / FolderLibrary / the apps all speak one interface.
//
// hydrate/dehydrate key off the *value* (is this a cap handle / a { __capfs }
// descriptor?), not off isNative(), so the web path stays a pure identity and
// existing browser records are untouched.

// :::::: THE BRIDGE
//
// the npm @capacitor/* packages are never bundled into what the webview loads
// (server.url points at the live origin — see the build-capacitor workflow). what
// *is* there is the bridge Capacitor injects as globalThis.Capacitor, with every
// installed plugin under Capacitor.Plugins. so we reach the plugins through that
// and keep the import map free of capacitor entries.

/** running inside the native Capacitor wrapper (vs a plain browser)? */
export const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

const plugin = name => {
  const p = globalThis.Capacitor?.Plugins?.[name];
  if (!p) throw new Error(`[fs/platform] the "${name}" Capacitor plugin is not available`);
  return p;
};

const Filesystem = () => plugin('Filesystem');
const FilePicker  = () => plugin('FilePicker');   // @capawesome/capacitor-file-picker

// :::::: base64 <-> binary (the plugin speaks base64 for file bodies)

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

// content:// URIs cannot be reliably extended by string concatenation, but file://
// ones can, and that is the only place a joined child URI is used (create paths).
// readdir returns each child's real URI, so the read path never joins.
const joinUri = (parent, name) => `${parent.replace(/\/+$/, '')}/${encodeURIComponent(name)}`;

// :::::: THE CAPACITOR HANDLE SHIM
//
// android folder grants come from the Storage Access Framework: a directory is
// picked with the file-picker plugin, which hands back a *persisted* content://
// tree URI — the fix for the browser File System Access pain on android (a fresh
// confirmation every visit). a handle's identity here is its URI. the read path
// (readdir / readFile / stat) drives every folder app; writes on a SAF tree are
// best-effort (see createWritable / getFileHandle).

class CapFileHandle {
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
   * a writable that buffers writes and flushes once on close, since the plugin has
   * no streaming write. good enough for the small files the apps produce. creating
   * a brand-new file under a SAF content:// tree this way is best-effort;
   * overwriting an existing file (the common case) is reliable.
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

  async isSameEntry (other)  { return other?._uri === this._uri; }
  async queryPermission ()   { return 'granted'; }   // the SAF grant is persisted at pick time
  async requestPermission () { return 'granted'; }
}

class CapDirHandle {
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

// name a tree URI for display: decode its last path segment, which for a SAF tree
// URI is the document id (e.g. "primary:Music") — take the part after ':'.
function nameFromUri (uri) {
  try {
    const last = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() || '');
    const tail = last.split(':').pop();
    return tail || last || 'folder';
  } catch { return 'folder'; }
}

async function capPick () {
  try {
    const res = await FilePicker().pickDirectory();          // persists the grant on android
    const uri = res?.path ?? res?.uri;
    if (!uri) return null;
    return new CapDirHandle(uri, nameFromUri(uri));
  } catch (err) {
    if (/cancel/i.test(err?.message || '')) return null;     // normalise user-cancel to null
    throw err;
  }
}

const isCapRef    = v => v && typeof v === 'object' && v.__capfs === true;
const capHydrate  = ref    => new CapDirHandle(ref.uri, ref.name);
const capDehydrate = handle => ({ __capfs: true, uri: handle._uri, name: handle.name });

// :::::: THE PUBLIC SEAM

/** can this platform grant a folder at all? */
export function supported () {
  return isNative()
    ? true
    : (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');
}

/**
 * open the folder picker → a live directory handle, or null if cancelled. on the
 * web this is showDirectoryPicker (must run inside a user gesture); on native the
 * SAF picker, which persists the grant so it survives restarts. either way the
 * result satisfies the shared handle interface.
 */
export async function pick ({ id, mode = 'read', startIn } = {}) {
  if (isNative()) return capPick();
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try {
    return await window.showDirectoryPicker({ id, mode, startIn });
  } catch (err) {
    if (err?.name === 'AbortError') return null;   // the user dismissed the picker
    throw err;
  }
}

export const
pickDir   = pick,
dehydrate = handle => (handle instanceof CapDirHandle ? capDehydrate(handle) : handle),
hydrate   = ref    => (isCapRef(ref) ? capHydrate(ref) : ref);
