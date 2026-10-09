// shared/js/components/Slider.js
//
// wraps <input-number look="slider">. the apps here all want a single number,
// so that is what goes in and comes out. the element renders its own readout
// and unit, the wrapper adds none.

import { html } from './../vendors.js';

function Slider ({
  label,
  value,
  min  = 0,
  max  = 100,
  step = 1,
  style,
  unit,
  onChange,
}) {
  const isFloat  = step < 1;
  const decimals = step < 0.01 ? 4 : 2;
  const clamp    = v => Math.min(max, Math.max(min, v));
  const disp     = isFloat ? +Number(value).toFixed(decimals) : Math.round(value);
  const onInput  = event => onChange?.(clamp(Number(event.currentTarget.value)));

  return html`
    <div class="slider-row">
      ${label && html`<span class="slider-label">${label}</span>`}

      <div class="slider-track" style=${style}>
        <input-number
          look="slider"
          ...${{ step, unit, onInput }}
          min=${String(min)}
          max=${String(max)}
          value=${String(disp)}
        ></input-number>
      </div>
    </div>`;
}

export       { Slider };
export default Slider;
