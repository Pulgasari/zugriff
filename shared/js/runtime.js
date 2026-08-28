// shared/js/runtime.js
//
// the `zugriff` runtime — a single object hung on globalThis so any app or
// component can reach the shared platform without importing it. it is
// established once (boot() imports this module for its side effect), and grows
// as more of the platform is worth sharing this way.
//
//   zugriff.opfs              the private Origin Private File System (one per origin)
//   zugriff.fs                the File System Access surface (picker / perms / walk)
//   zugriff.fs.FolderLibrary  ctor for an app's granted-folder library
//
// apps may use it globally (`zugriff.fs.pickDirectory(…)`) or import the named
// binding below when they need it before the global is guaranteed to exist —
// e.g. building a FolderLibrary at a db.js module's top level.

import { opfs } from './filesystem/opfs.js';
import * as fsaccess from './filesystem/fsaccess.js';
import { FolderLibrary } from './filesystem/folders.js';

export const zugriff = {
  opfs,
  fs: Object.assign({ FolderLibrary }, fsaccess),
};

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

export default zugriff;
