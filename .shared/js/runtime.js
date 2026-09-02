// .shared/js/runtime.js
// assembles the `zugriff` global — the ambient surface apps reach for without an
// import (zugriff.app, zugriff.components, zugriff.fs, zugriff.toast, …). importing
// this module (directly, or transitively via an app's db.js) installs it.

// :::::: IMPORTS

import * as components from './components/index.js';
import registry        from './data/apps.js';
import createApp       from './app.js';
import { toast }       from './app/toast.js';

import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';
import * as pwa          from './app/pwa.js';

// :::::: BUNDLE

const zugriff = { components, opfs, pwa, registry, toast };

zugriff.app = createApp;                                 // zugriff.app('<slug>') -> app handle
zugriff.fs  = Object.assign({ FolderLibrary }, fsaccess);

zugriff.openPrompt     = components.openPrompt;
zugriff.toggleSettings = components.toggleSettings;

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

// :::::: EXPORT

export       { zugriff };
export default zugriff;
