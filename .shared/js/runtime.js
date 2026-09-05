// .shared/js/runtime.js
// assembles the `zugriff` global — the ambient surface apps reach for without an
// import (zugriff.app, zugriff.components, zugriff.fs, zugriff.toast, …). importing
// this module (directly, or transitively via an app's db.js) installs it.

// :::::: IMPORTS
/*
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
*/
// ============ NEW ==========================================================

// :::::: IMPORTS

import registry          from './data/apps.js';
import { ZugriffApp }    from './app.js';
import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';

// import * as pwa  from './app/pwa.js';
import { toast } from './app/toast.js';

// :::::: CONSTS

const PATH_COMPS  = '/.shared/js/components';
const PATH_VENDOR = '/.shared/js/vendors.js';

// :::::: METHODS

//const loadModule    = (path)      => import(path).then(mod => mod.default ?? mod);
const loadModule    = (path, sub) => import(path).then(mod => (sub ? mod[sub] : (mod.default ?? mod)));
const loadComponent = (name, sub) => loadModule(`${PATH_COMPS}/${name}.js`, sub);        
const loadVendor    = (name)      => {};

// :::::: BUNDLE

const zugriff = {
  // namespaces
  fs: Object.assign({ FolderLibrary }, fsaccess),
  opfs,
  registry,
  toast,

  // methods
  loadComponent,
  loadModule,
  loadVendor,
};

zugriff.getApp         = (slug) => new ZugriffApp (slug);
zugriff.openPrompt     = await loadComponent ('Prompt', 'openPrompt');
zugriff.toggleSettings = await loadComponent ('Settings', 'toggleSettings');

/* === dynamic module loader =======================================
const signal = await zugriff.load('@aufbau/signals', { signal });
const signal = await zugriff.load('@aufbau/signals', ['signal']);
const signal = await zugriff.load('@aufbau/signals',  'signal' );

import { signal } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
==================================================================== */


/*
// usage
const zugriff = new ZugriffRuntime;

const AppSettings = await zugriff.loadComponent('AppSettings');
const Icon        = await zugriff.loadComponent('Icon');
*/

// :::::: EXPORT

if (typeof globalThis !== 'undefined') globalThis.zugriff = zugriff;

export       { zugriff };
export default zugriff;
