// shared/js/runtime.js

// :::::: IMPORT

import registry from './registry.js'

import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';

// :::::: BUNDLE

const zugriff = { opfs, registry };

zugriff.fs = Object.assign({ FolderLibrary }, fsaccess);

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

// :::::: EXPORT

export       { zugriff };
export default zugriff;
