// shared/js/components/Icon.js
//
// thin wrapper around <aufbau-icon>. the short name map lives in
// ./../data/icons.js.

import { html } from '@aufbau/kits/preact-htm';
import { resolveIcon } from './../data/icons.js';

// size and color go in as attributes, not as inline custom properties:
// <aufbau-icon> rewrites --icon-size/--icon-color on every sync, so anything
// set on the style attribute would be wiped on the next repaint.

// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === ''         ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  :                                       value;

// both `class` and `className` are accepted — the call sites use them mixed
export default function Icon ({ name, size, color, className, class: klass, onClick, title, style }) {
  return html`
    <aufbau-icon
      class=${['icon', className, klass].filter(Boolean).join(' ')}
      icon=${resolveIcon(name)}
      size=${length(size)}
      color=${color}
      style=${style}
      title=${title}
      onClick=${onClick}
    ></aufbau-icon>`;
}

export { icons, resolveIcon } from './../data/icons.js';
