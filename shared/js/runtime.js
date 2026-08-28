// shared/js/runtime.js


import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }.         from './filesystem/opfs.js';

export const zugriff = {
  opfs,
  fs: Object.assign({ FolderLibrary }, fsaccess),
};

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

export default zugriff;
