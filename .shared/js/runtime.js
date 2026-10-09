// .shared/js/runtime.js
// binds zugriff and html to window before any app module runs

import registry          from './data/apps.js';
import { ZugriffApp, many } from './app.js';
import fmt               from './modules/fmt.js';
import * as fs           from './modules/fs.js';
import { opfs }          from './modules/opfs.js';
import { toast }         from './modules/toast.js';
import { html }          from './vendors.js';

const loadModule = async (spec, member) => {
  const imported = await import(spec);
  return member ? imported[member] : (imported.default ?? imported);
};

const loadComponent = (name, member) => loadModule(`/.shared/js/components/${name}.js`, member);

// the app is named by <html data-app>, set by the shell or the bundle
const slug = document.documentElement.dataset.app;

const zugriff = {
  fmt,
  fs,
  opfs,
  registry,
  toast,

  component  : loadComponent,
  components : many(loadComponent),
  module     : loadModule,
  modules    : many(loadModule),

  app : registry.has(slug) ? new ZugriffApp(slug) : null,
};

globalThis.html    = html;
globalThis.zugriff = zugriff;

export       { zugriff };
export default zugriff;
