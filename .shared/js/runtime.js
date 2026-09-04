// .shared/js/runtime.js
// assembles the `zugriff` global — the ambient surface apps reach for without an
// import (zugriff.app, zugriff.components, zugriff.fs, zugriff.toast, …). importing
// this module (directly, or transitively via an app's db.js) installs it.

// :::::: IMPORTS

import * as components from './components/index.js';
import registry        from './data/apps.js';
import createApp       from './app.js';
import { App }         from './app.js';
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

// ::: NEW

zugriff.getApp = (slug) => new App (slug);

function moduleProxy(path) {
  return new Proxy({}, {
    get(_, name) {
      return import(`${path}/${name}.js`).then(m => m.default ?? m);
    }
  });
}

const PATH_COMPS   = '/.shared/js/components';
const PATH_VENDOR  = '/.shared/js/vendors.js';

const importModule = (path) => import(path).then(m => m.default ?? m);

zugriff.importComponent = (name) => importModule(`${PATH_COMPS}/${name}.js`);        
zugriff.importVendor    = (name) => {};

// usage
const components = moduleProxy('/.shared/js/components');

const AppSettings = await zugriff.importComponent('AppSettings');
const Icon        = await zugriff.importComponent('Icon');

// :::::: EXPORT

export       { zugriff };
export default zugriff;
