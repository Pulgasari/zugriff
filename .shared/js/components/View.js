// components/View.js
// the outer frame every app view sits in: an optional back button, an optional
// header (title + right-aligned tools), then the view body. list views pass
// `title`/`tools`; detail views pass `back` and bring their own header as
// children.

import { html } from './../vendors.js';
import Button   from './Button.js';

function View ({ title, back, tools, children, ...rest }) {
  return html`
    <div class='View' ...${rest}>
      ${back && html`<${Button} class='ViewBack' icon='arrow-left' ...${back} />`}

      ${(title || tools) && html`
        <header>
          ${title && html`<h1>${title}</h1>`}
          ${tools && html`<div class='ViewTools'>${tools}</div>`}
        </header>`}

      ${children}
    </div>
  `;
}

export       { View };
export default View;
