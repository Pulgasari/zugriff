// shared/js/components/Icon.js

import { html }        from './../vendors.js';
import { resolveIcon } from './../data/icons.js';

// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === '' ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  : value;

function Icon ({ name, size, color, className, class: klass, onClick, title, style }) {
  return html`
    <aufbau-icon
      class=${['icon', className, klass].filter(Boolean).join(' ')}
      icon=${resolveIcon(name)}
      size=${length(size)}
      ...${{ color, onClick, style, title }}
    ></aufbau-icon>`;
}

export { icons, resolveIcon } from './../data/icons.js';

export       { Icon };
export default Icon;

