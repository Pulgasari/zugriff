// components/Image.js

import { html } from './../vendors.js';

function btn (comp, rest) {
  return rest.onClick ? html`<button class='naked'>${comp}</button>` : comp;
}

function Image ({ loading = 'lazy', src, ...rest }) {
  const comp = html`<img ...${{ loading, src, ...rest }} />`;
  return btn(comp, rest);
}

/*
function btn2 (comp) {
  return html`<button class='naked'>${comp}</button>`;
}

function Image2 ({ loading = 'lazy', src, ...rest }) {
  const comp = html`<img ...${{ loading, src, ...rest }} />`;
  return rest.onClick ? btn(comp) : comp;
}
*/

export       { Image };
export default Image;
