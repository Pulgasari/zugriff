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

function App () {
  return html`
    <div id="app-body">
      <${Icon} name=${config.app.icon} size="48" />
      <p>${config.app.description}</p>
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
