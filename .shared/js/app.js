// .shared/js/app.js
// the app factory behind zugriff.app. a page opens with
//
//   const app = zugriff.app('notes');
//
// which resolves that slug's registry entry, builds its reactive state and hands
// back the app handle. one instance per slug (a page is one app), so repeat calls
// are idempotent. the goal is to collapse each app's app.js boilerplate: state,
// its cross-cutting effects and the mount all live here, not in every app.
//
//   app.state.font = 'Inter';       // reactive, drives the shared webfonts effect
//   app.setState('font', 'Inter');  // same, imperative form
//   app.init({ App });              // mount (replaces the old boot())

// :::::: IMPORTS

import { configFor }  from './app/config.js';
import { createState } from './app/state.js';
import { toast }       from './app/toast.js';
import * as pwa        from './app/pwa.js';

import { aufbau, html, render } from './vendors.js';
import Shell from './components/Shell.js';

// :::::: FACTORY

const instances = new Map();

export function createApp (slug) {
  if (instances.has(slug)) return instances.get(slug);

  const config = configFor(slug);
  const state  = createState(config);

  const app = { slug, config, state, toast };

  // ::: state helpers — thin sugar over the deepSignal
  app.getState    = key          => state[key];
  app.setState    = (key, value) => state[key] = value;
  app.toggleState = (key, force) => state[key] = force ?? !state[key];
  app.resetState  = key          => state[key] = key in config ? config[key] : null;
  app.setDialog   = (id = null)  => state.dialog = id;
  app.setRoute    = (id = null)  => state.route  = id;

  // ::: pwa (install-to-home-screen), lifted straight off the shared plumbing
  app.canInstall    = pwa.canInstall;
  app.isInstalled   = pwa.isInstalled;
  app.promptInstall = pwa.promptInstall;

  // ::: mount. tools get the shared Shell frame; apps own the whole #app root
  // (shell defaults off for type:'app', on otherwise) and can force it either way.
  app.init = async ({ App, target = '#app', shell } = {}) => {
    const useShell = shell ?? config.type === 'tool';

    await aufbau.init(config.aufbau);

    const $target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!$target) throw new Error(`[zugriff] mount target "${target}" not found`);

    if (App) render(useShell ? html`<${Shell} app=${config}><${App} /><//>` : html`<${App} />`, $target);

    return app;
  };

  instances.set(slug, app);
  createApp.current = app;   // the page's active app — shared components (AppSettings) read it
  return app;
}

// :::::: EXPORT

export { createApp as app };
export default createApp;
