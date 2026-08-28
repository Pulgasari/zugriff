// shared/js/filesystem/index.js
//
// one entry point for the filesystem layer. most code reaches these through the
// runtime (`zugriff.opfs`, `zugriff.fs.…`); import from here when you want an
// explicit binding (e.g. constructing a FolderLibrary at a module's top level,
// where relying on the global's load order would be fragile).

export { opfs, OPFS, vfs, VFS } from './opfs.js';   // the private OPFS
export * as fsaccess from './fsaccess.js';           // File System Access: picker/perms/walk
export * as dirfs    from './dirfs.js';              // directory-tree ops over any root handle
export { FolderLibrary } from './folders.js';        // the granted-folder lifecycle
export { syncSource, MetaQueue, signatureOf } from './scan.js';   // scan building blocks
