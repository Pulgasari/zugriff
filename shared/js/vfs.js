// Virtual File System wrapper using Origin Private File System (OPFS)

export class VFS {
  constructor() {
    this.root = null;
  }

  // Initialize connection to browser OPFS
  async init() {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      this.root = await navigator.storage.getDirectory();
    } else {
      throw new Error('OPFS is not supported in this browser environment.');
    }
  }

  // List all files in the root virtual directory
  async listFiles() {
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
  async writeFile(filename, data) {
    if (!this.root) await this.init();
    const fileHandle = await this.root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  // Read a file from OPFS as ArrayBuffer
  async readFile(filename) {
    if (!this.root) await this.init();
    const fileHandle = await this.root.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  }

  // Remove a file from OPFS
  async removeFile(filename) {
    if (!this.root) await this.init();
    await this.root.removeEntry(filename);
  }
}

export const vfs = new VFS();
