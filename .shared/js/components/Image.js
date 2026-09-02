// components/Image.js

import { html } from './../vendors.js';

function Image ({ loading = 'lazy', src, ...rest }) {
  return html`<img ...${{ loading, src, ...rest }} />`;
}

export       { Image };
export default Image;
