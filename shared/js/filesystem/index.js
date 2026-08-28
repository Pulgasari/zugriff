// shared/js/filesystem/index.js

export { opfs, OPFS, vfs, VFS }               from './opfs.js';     // the private OPFS
export * as fsaccess                          from './fsaccess.js'; // File System Access: picker/perms/walk
export * as dirfs                             from './dirfs.js';    // directory-tree ops over any root handle
export { FolderLibrary }                      from './folders.js';  // the granted-folder lifecycle
export { syncSource, MetaQueue, signatureOf } from './scan.js';     // scan building blocks
