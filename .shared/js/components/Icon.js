// shared/js/components/Icon.js
// <svg-icon> resolves a bare name through the @aufbau/svg aliases itself

import { html } from './../vendors.js';

// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === '' ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  : value;

function Icon ({ name, size, color, className, class: klass, onClick, title, style }) {
  return html`
    <svg-icon
      class=${['icon', className, klass].filter(Boolean).join(' ')}
      icon=${name}
      size=${length(size)}
      ...${{ color, onClick, style, title }}
    ></svg-icon>`;
}

export       { Icon };
export default Icon;

