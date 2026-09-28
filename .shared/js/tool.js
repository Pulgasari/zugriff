// .shared/js/tool.js
// the entry of a tool page. a tool lives on a page of its own (tools/<slug>/),
// the runtime has no app handle for it, so this takes one by the slug of its
// registry entry and mounts the tool in the shared Shell:
//
//   import defineTool from '/.shared/js/tool.js';
//   const { boot, config } = defineTool('uuid-generator');
//   boot({ App });

import zugriff  from './runtime.js';
import Shell    from './components/Shell.js';
import { html } from './vendors.js';

function defineTool (slug) {
  const app    = zugriff.getApp(slug);
  const config = app.config;

  // `shell: false` for a tool that draws its own frame
  const boot = ({ App, shell = true }) => app.init({
    App: shell ? () => html`<${Shell} app=${config}><${App} /><//>` : App,
  });

  return { app, boot, config };
}

export { defineTool };
export default defineTool;
