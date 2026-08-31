// shared/js/runtime.js

// :::::: IMPORT

import * as components from './components/index.js';
import      registry   from './registry.js'

import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';
import * as pwa          from './lib/pwa.js';

// :::::: BUNDLE

const zugriff = { components, opfs, pwa, registry };

zugriff.fs = Object.assign({ FolderLibrary }, fsaccess);

zugriff.openPrompt     = components.openPrompt;
zugriff.toggleSettings = components.toggleSettings;
zugriff.toast          = components.toast;

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

// :::::: EXPORT

export       { zugriff };
export default zugriff;
