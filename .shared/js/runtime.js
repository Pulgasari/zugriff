// .shared/js/runtime.js
// the global runtime — `zugriff` on window, with `zugriff.app` the current app
// handle. boot.js imports this (blocking, in <head>) so every page has the runtime
// bound before its app module runs; an app therefore never imports the runtime, it
// reaches everything through the `zugriff` / `zugriff.app` globals.

// :::::: IMPORTS

import registry          from './data/apps.js';
import { ZugriffApp }    from './app.js';
import { FolderLibrary } from './filesystem/folders.js';
import * as fsaccess     from './filesystem/fsaccess.js';
import { opfs }          from './filesystem/opfs.js';
import { toast }         from './app/toast.js';

// ::: the one fragment-aware html tag (see vendors.js), exposed as a global so
//     components need no import and `<>...</>` works everywhere
import { html }          from './vendors.js';

// :::::: CONSTS

const PATH_COMPS = '/.shared/js/components';

// friendly aliases → importmap specifiers for zugriff.module(name)
const vendorsMap = {
  filters  : '@aufbau/filters',
  gestures : '@aufbau/gestures',
  patterns : '@aufbau/patterns',
  signals  : '@aufbau/signals',
  signal   : '@aufbau/signals',
  webfonts : '@aufbau/webfonts',

  is     : '@pulgasari/is',
  obj    : '@pulgasari/obj',
  str    : '@pulgasari/str',
  timing : '@pulgasari/timing',
};

// :::::: LOADERS

async function loadModule (spec, member) {
  const imported = await import(vendorsMap[spec] || spec);
  return member ? imported[member] : (imported.default ?? imported);
}

const loadComponent = (name, member) => loadModule(`${PATH_COMPS}/${name}.js`, member);

// :::::: APP INSTANCES
// one handle per slug (a page is one app), so repeat lookups are idempotent.

const instances = new Map();
const getApp = slug => {
  if (!instances.has(slug)) instances.set(slug, new ZugriffApp(slug));
  return instances.get(slug);
};

const route      = window.location.pathname.split('/')[1] || null;
const isAppRoute = route !== null && route !== 'apps' && route !== 'tools';

// :::::: BUNDLE

const zugriff = {
  // namespaces
  fs: Object.assign({ FolderLibrary }, fsaccess),
  opfs,
  registry,
  toast,

  // loaders
  component : loadComponent,
  module    : loadModule,
  loadComponent,
  loadModule,

  // app handles
  getApp,
  app : isAppRoute ? getApp(route) : null,
};

// bind to window before any app module runs
if (typeof globalThis !== 'undefined') {
  globalThis.html    = html;
  globalThis.toast   = toast;
  globalThis.zugriff = zugriff;
}

// :::::: EXPORT

export       { zugriff };
export default zugriff;
