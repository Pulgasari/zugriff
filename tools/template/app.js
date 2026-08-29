// tools/template/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html } from '@aufbau/kits/preact-htm';

// ::: shared
// this app pulls its own registry entry in through the module url — change the
// slug to yours after adding a `{ type: 'tool', slug: '<slug>', … }` entry to
// shared/js/registry.js. `config` is that entry; boot reads the title, theme and
// aufbau options off it, and wraps a tool in the shared Shell from its type.
import { boot, config } from '/.shared/js/app.js?slug=template';
import { Icon } from '/.shared/js/components/index.js';

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  return html`
    <div id="app-body">
      <${Icon} name=${config.icon} size="48" />
      <p>${config.description}</p>
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
