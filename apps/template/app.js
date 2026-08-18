// apps/template/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Icon } from './../../shared/js/components/index.js';

// ::: local
import * as config from './app.config.js';

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

// an app draws its own chrome — there is no tools Shell here. boot() is called
// with `shell: false`, so this component owns the whole #app frame.

function App () {
  return html`
    <header class="topbar">
      <${Icon} name=${config.app.icon} size="20" />
      <strong>${config.app.name}</strong>
    </header>
    <main class="stage">
      <p>${config.app.description}</p>
    </main>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App, shell: false });
