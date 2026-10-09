// .shared/js/modules/opfs.js
//
// the private Origin Private File System — storage the origin owns outright, with
// no picker and no permission prompt. deliberately kept apart from the rest of the
// fs layer (which is about folders the *user* grants off their disk): there is
// exactly one OPFS per origin, so this exports a single shared instance (`opfs`),
// and it hangs off the runtime as its own `zugriff.opfs`, not under `zugriff.fs`.
//
// the flat api (listFiles / readFile / writeFile / removeFile, filename only) is
// all the cli needs. anything that walks a tree of handles uses handles.js on top
// of a root handle instead — and `opfsBackend` below hands that root to the
// FileExplorer component, so the same tree ui browses OPFS and granted folders alike.

export class OPFS {
  constructor () {
    this.root = null;
  }

  /** connect to the browser OPFS root (lazy, once) */
  async init () {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      this.root = await navigator.storage.getDirectory();
    } else {
      throw new Error('OPFS is not supported in this browser environment.');
    }
    return this.root;
  }

  /** list the files in the flat root */
  async listFiles () {
    if (!this.root) await this.init();
    const files = [];
    for await (const [name, handle] of this.root.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        files.push({ name, size: file.size, lastModified: file.lastModified });
      }
    }
    return files;
  }

  /** write a file buffer */
  async writeFile (filename, data) {
    if (!this.root) await this.init();
    const fileHandle = await this.root.getFileHandle(filename, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  /** read a file as ArrayBuffer */
  async readFile (filename) {
    if (!this.root) await this.init();
    const handle = await this.root.getFileHandle(filename);
    const file   = await handle.getFile();
    return         await file.arrayBuffer();
  }

  /** remove a file */
  async removeFile (filename) {
    if (!this.root) await this.init();
    await this.root.removeEntry(filename);
  }
}

const isFn = sth => typeof sth === 'function';

/** is OPFS usable in this browser at all? */
export const opfsSupported = () => isFn(navigator?.storage?.getDirectory);

/** { usage, quota } in bytes for the origin's storage, best-effort */
export async function usageEstimate () {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return { usage: 0, quota: 0 };
}

/**
 * a FileExplorer backend over OPFS. a backend hands the component a root and says
 * what it can do: { id, label, writable, supported(), getRoot(), usage?() }.
 * drop `<${FileExplorer} backend=${zugriff.opfs.backend} />` into any app to browse it.
 */
export const opfsBackend = {
  id        : 'opfs',
  label     : 'private storage',
  writable  : true,
  supported : opfsSupported,
  getRoot   : () => navigator.storage.getDirectory(),
  usage     : usageEstimate,
};

export const opfs = new OPFS;
opfs.backend = opfsBackend;   // so `zugriff.opfs.backend` reaches the FileExplorer backend

// legacy names — the class and instance used to be VFS / vfs (vfs.js). kept so
// existing importers (e.g. cli/app.js) keep working.
export const VFS = OPFS;
export const vfs = opfs;

export default opfs;
