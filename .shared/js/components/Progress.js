// components/Progress.js

import { html } from './../vendors.js';

function Progress ({ value = 0, max, ...rest }) {
  const pct = max ? Math.min(100, value / max * 100) : value;
  return html`<aufbau-progress class='Progress' value=${pct} ...${rest}></aufbau-progress>`;
}

export       { Progress };
export default Progress;
