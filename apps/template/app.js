// apps/template/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html } from '@aufbau/kits/preact-htm';

// ::: shared
// this app pulls its own registry entry in through the module url — change the
// slug to yours after adding a `{ type: 'app', slug: '<slug>', … }` entry to
// shared/js/registry.js. `config` is that entry; boot reads the title, theme and
// aufbau options off it. an app has `type: 'app'`, so boot skips the tools Shell
// and this component owns the whole #app frame.
import { boot, config } from './../../.shared/js/app.js?slug=template';
import { Icon } from './../../.shared/js/components/index.js';

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  return html`
    <header class="topbar">
      <${Icon} name=${config.icon} size="20" />
      <strong>${config.name}</strong>
    </header>
    <main class="stage">
      <p>${config.description}</p>
    </main>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
