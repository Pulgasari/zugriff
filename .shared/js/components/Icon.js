// shared/js/components/Icon.js

import { resolveIcon } from './../data/icons.js';

// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === '' ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  : value;

function Icon ({ name, size, ...rest }) {
  return html`
    <svg-icon
      class='icon'
      icon=${resolveIcon(name)}
      size=${length(size)}
      ...${rest}
    ></svg-icon>`;
}

export { icons, resolveIcon } from './../data/icons.js';

export       { Icon };
export default Icon;

