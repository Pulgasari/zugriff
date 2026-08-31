// components/Image.js

import { html } from '@aufbau/kits/preact-htm';

function Image ({ alt = '', loading = 'lazy', src }) {
  return html`<img src=${src} alt=${alt} loading=${loading} />`;
}

export       { Image };
export default Image;
