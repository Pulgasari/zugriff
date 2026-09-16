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

class CapacitorFileHandle {
  kind = 'file';
  
  constructor ({ name, path }) { 
    this.path = path;
    this.name = name;
  }

  /** the live File, read fresh from disk — mirrors FileSystemFileHandle.getFile() */
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

  /**
   * a writable that buffers writes and flushes once on close, since the plugin has
   * no streaming write. good enough for the small files the apps produce. creating
   * a brand-new file under a SAF content:// tree this way is best-effort;
   * overwriting an existing file (the common case) is reliable.
   */
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

  async isSameEntry (other)  { return other?._uri === this._uri; }
  async queryPermission ()   { return 'granted'; }   // the SAF grant is persisted at pick time
  async requestPermission () { return 'granted'; }
}

// web / browser

const webFS = {};

webFS.pick = async function ({ id, mode = 'read', startIn } = {}) {
  if (!supported()) throw new Error('This browser cannot open a folder — try a Chromium-based one.');
  try           { return await window.showDirectoryPicker({ id, mode, startIn }); }
  catch (error) { if (error?.name === 'AbortError') return null; throw error; }
}

