// fs.js

const isString = sth => typeof sth === 'string';

const getPlatform = () => !!globalThis.Capacitor?.isNativePlatform?.() ? 'cap' : 'web';
const PLATFORM    = getPlatform();

function isSupported () {
  if (PLATFORM === 'cap') return true;
  if (PLATFORM === 'web') return (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');
}

async function pick ({ id, mode = 'read', startIn } = {}) {
  if (PLATFORM === 'cap') return capFS.pick();
  if (PLATFORM === 'web') return webFS.pick({ id, mode, startIn });
}

// capacitor / android

// name a tree URI for display: decode its last path segment, which for a SAF tree
// URI is the document id (e.g. "primary:Music") — take the part after ':'.
function getNameFromUri (uri) {
  try {
    const last = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() || '');
    const tail = last.split(':').pop();
    return tail || last || 'folder';
  }
  catch { return 'folder'; }
 }

const cap = {};

cap.pick = async () => {
  try {
    const res  = await FilePicker().pickDirectory(); // persists the grant on android
    const uri  = res?.path ?? res?.uri;
    const name = getNameFromUri(uri);
    return uri ? new CapDirHandle ({ name, uri }) : null
  }
  catch (err) {
    if (/cancel/i.test(err?.message || '')) return null;     // normalise user-cancel to null
    throw err;
  }
}


const CapacitorFP = () => plugin('FilePicker');   // @capawesome/capacitor-file-picker
const CapacitorFS = () => plugin('Filesystem');

class CapacitorHandle {
  constructor ({ name, path }) {
    this.name = name;
    this.path = path;
  }
  async isSameEntry       (other) { return other?.path === this.path; }
  async queryPermission   ()      { return 'granted'; }   // the SAF grant is persisted at pick time
  async requestPermission ()      { return 'granted'; }
}

class CapacitorDirHandle extends CapacitorHandle {
  kind = 'directory';
  constructor (args) { super(args); }

  async #children () {
    const { files = [] } = await CapacitorFS().readdir({ path: this.path });
    return files.map(file => ({ 
      name : file.name, 
      kind : file.type === 'directory' ? 'dir' : 'file', 
      uri  : file.uri ?? joinUri(this.path, file.name) 
    }));
  }

  async *entries () { for (const c of await this.#children()) yield [c.name, getHandle(c)]; }    
  async *keys    () { for (const c of await this.#children()) yield c.name; }
  async *values  () { for await (const [, h] of this.entries()) yield h; }
  
  async getDirHandle (name, { create = false } = {}) {
    for (const c of await this.#children())
      if (c.name === name && c.kind === 'directory') return new CapDirHandle(c.uri, c.name);
    if (!create) throw new DOMException(`${name} not found`, 'NotFoundError');
    const uri = joinUri(this._uri, name);
    await Filesystem().mkdir({ path: uri, recursive: false });
    return new CapDirHandle(uri, name);
  }

  getHandle (children) {
    return children.kind === 'dir' 
      ? new CapacitorDirHandle  ({ name: c.name, path: c.uri }) 
      : new CapacitorFileHandle ({ name: c.name, path: c.uri });
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
}

class CapacitorFileHandle extends CapacitorHandle {
  kind = 'file';
  constructor (args) { super(args); }

  async getFile () {
    const stat  = await Filesystem().stat({ path: this.path }); 
    const mtime = stat.mtime ?? Date.now(); 
    const size  = stat.size  ?? null;
    
    const { data } = await Filesystem().readFile({ path: this.path });   // base64, no encoding => binary-safe
    const b64      = isString(data) ? data : ''
    const buffer   = b64ToArrayBuffer(b64);
    const type     = mimeOf(this.name);
    
    return new File ([buffer], this.name, { type, lastModified: mtime });
  }

  async createWritable () {
    const path = this.path; 
    const chunks = [];
    
    return {
      async write (data) {
        const buffer = await toArrayBuffer (data);
        chunks.push(buffer); 
      },
      async close () {
        const buffer = await new Blob (chunks).arrayBuffer();
        const data   = arrayBufferToB64(buffer);
        await Filesystem().writeFile({ path, data });
      },
      async abort () {},
    };
  }

  
}

// web / browser

const webFS = {};

webFS.pick = async function ({ id, mode = 'read', startIn } = {}) {
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try           { return await window.showDirectoryPicker({ id, mode, startIn }); }
  catch (error) { if (error?.name === 'AbortError') return null; throw error; }
}

