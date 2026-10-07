// components/View.js

import GoBackButton from './GoBackButton.js';

function View ({ title, back, tools, children, ...rest }) {
  return html`
    <div class='View view' ...${rest}>
      <header>
        ${back  && html`<btn-icon class='ViewBack' icon='arrow-left' label='back' ...${back} />`}      
        ${title && html`<h1>${title}</h1>`}
        ${tools && html`<div class='ViewTools'>${tools}</div>`}
      </header>
      ${children}
    </div>
  `;
}

export       { View };
export default View;
