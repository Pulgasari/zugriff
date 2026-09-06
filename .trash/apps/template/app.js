// apps/template/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html } from '@aufbau/kits/preact-htm';

// ::: shared
// zugriff.app('<slug>') resolves this app's registry entry, builds its reactive
// state and returns the handle — change the slug to yours after adding a
// `{ type: 'app', slug: '<slug>', … }` entry to .shared/js/data/apps.js. `app.config`
// is that entry (title/theme/lang/aufbau options ride through the shared state
// effects). app.init mounts; type 'app' skips the tools Shell, so this component
// owns the whole #app frame.
import { zugriff } from '/.shared/js/runtime.js';
const app    = zugriff.app('template');
const config = app.config;
import { Icon } from '/.shared/js/components/index.js';

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  return html`
    <header class="topbar">
      <${Icon} name=${config.icon} />
      <strong>${config.name}</strong>
    </header>
    <main class="stage">
      <p>${config.description}</p>
    </main>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
