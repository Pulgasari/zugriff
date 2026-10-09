// apps/tools/app.js
// the tools as one app. the shelf lists them, every tool is a view of its own
// (views/<slug>.js, its css in views/<slug>.css), imported when it is first opened.
// the list is tools.js

const app = zugriff.app;

// :::::: IMPORT

import { useSlot } from '/.shared/js/components/Slot.js';

import { tools } from './tools.js';

const { Config, ViewHeader, Views } = await zugriff.components('Config', 'ViewHeader', 'Views');

// :::::: VIEWS

// a tool under the head every tool shares, back to the shelf
function toolView (tool) {
  return function ToolView () {
    const Tool = useSlot('view', tool.slug);
    return html`
      <${ViewHeader} back='shelf' title=${tool.name} />
      <main class='tool'>${Tool && html`<${Tool} />`}</main>
    `;
  };
}

app.views = {
  shelf : { route: '/', view: 'ShelfView' },
  ...Object.fromEntries(tools.map(tool => [tool.slug, { route: `/${tool.slug}`, view: toolView(tool) }])),
};

// :::::: ROOT

function App () {
  return html`
    <app-area name='main'><${Views} lazy transition-on='glide' /></app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
