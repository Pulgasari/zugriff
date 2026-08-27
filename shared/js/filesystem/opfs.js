// shared/js/filesystem/opfs.js
//
// the private Origin Private File System (OPFS) — storage the origin owns
// outright, with no picker and no permission prompt. this is the counterpart to
// fsaccess.js, which wraps a folder the *user* hands us off their real disk.
// there is exactly one OPFS per origin, so this module exports a single shared
// instance (`opfs`); it is what hangs off the runtime as `zugriff.opfs`.
//
// a "path" here is a plain filename in the flat root — all the cli needs.
// anything that walks a tree of handles (OPFS or a granted folder alike) uses
// dirfs.js on top of a root handle instead.

export class OPFS {
  constructor () {
    this.root = null;
  }

  // Initialize connection to browser OPFS
  async init () {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      this.root = await navigator.storage.getDirectory();
    } else {
      throw new Error('OPFS is not supported in this browser environment.');
    }
  }

  // List all files in the root virtual directory
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

  // Write a file buffer to OPFS
  async writeFile (filename, data) {
    if (!this.root) await this.init();
    const fileHandle = await this.root.getFileHandle(filename, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  // Read a file from OPFS as ArrayBuffer
  async readFile (filename) {
    if (!this.root) await this.init();
    const handle = await this.root.getFileHandle(filename);
    const file   = await handle.getFile();
    return         await file.arrayBuffer();
  }

  // Remove a file from OPFS
  async removeFile (filename) {
    if (!this.root) await this.init();
    await this.root.removeEntry(filename);
  }
}

export const opfs = new OPFS;

// legacy names — the class and instance used to be called VFS / vfs (vfs.js).
// kept so existing importers (e.g. cli/app.js) keep working.
export const VFS = OPFS;
export const vfs = opfs;

export default opfs;
