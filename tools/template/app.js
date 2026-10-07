// tools/template/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html } from '/.shared/js/vendors.js';

// ::: shared
// this app takes its registry entry by the slug — change it to yours after
// adding a `{ type: 'tool', slug: '<slug>', … }` entry to .shared/js/data/apps.js.
// `config` is that entry, boot mounts the app in the shared Shell.
import defineTool from '/.shared/js/tool.js';

const { boot, config } = defineTool('template');

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  return html`
    <div id="app-body">
      <svg-icon icon=${config.icon} />
      <p>${config.description}</p>
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ App });
