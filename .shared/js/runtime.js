// .shared/js/runtime.js

// :::::: IMPORTS

import registry          from './data/apps.js';
import { ZugriffApp }    from './app.js';
import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';

// ::: htm
import { h } from 'preact';
import htm   from 'htm'; 
const html = htm.bind(h);

// import * as pwa  from './app/pwa.js';
import { toast } from './app/toast.js';

// :::::: CONSTS

const PATH_COMPS  = '/.shared/js/components';
const PATH_VENDOR = '/.shared/js/vendors.js';

// :::::: METHODS

const vendorsMap = {
  filters  : '@aufbau/filters',
  gestures : '@aufbau/gestures',
  patterns : '@aufbau/patterns',
  signals  : '@aufbau/signals',
  webfonts : '@aufbau/webfonts',

  is     : '@pulgasari/is',
  obj    : '@pulgasari/obj',
  str    : '@pulgasari/str',
  timing : '@pulgasari/timing',
  
  signal   : '@aufbau/signals',

  // preact
  // preact/hooks
};

async function loadModule (spec, module) {
  const resolved = vendorsMap[spec] || spec;
  const imported = await import(resolved);
  return module ? imported[module] : (imported.default ?? imported);
}
6
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
  component : loadComponent,
  module    : loadModule,
  loadComponent,
  loadModule,
  loadVendor,
};

zugriff.getApp         = (slug) => new ZugriffApp (slug);
zugriff.openPrompt     = await loadComponent ('Prompt', 'openPrompt');
zugriff.toggleSettings = await loadComponent ('Settings', 'toggleSettings');

// :::::: EXPORT

if (typeof globalThis !== 'undefined') {
  globalThis.html    = html;
  globalThis.zugriff = zugriff;
}

export       { zugriff };
export default zugriff;
