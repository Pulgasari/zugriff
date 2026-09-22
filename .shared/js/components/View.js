// components/View.js

import Button       from './Button.js';
import GoBackButton from './GoBackButton.js';

function View ({ title, back, tools, children, ...rest }) {
  return html`
    <div class='View view' ...${rest}>
      <header>
        ${back  && html`<${Button} class='ViewBack' icon='arrow-left' ...${back} />`}      
        ${title && html`<h1>${title}</h1>`}
        ${tools && html`<div class='ViewTools'>${tools}</div>`}
      </header>
      ${children}
    </div>
  `;
}

export       { View };
export default View;
