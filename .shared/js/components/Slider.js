// shared/js/components/Slider.js
//
// wraps <aufbau-slider>. the element carries its value as an array (it also
// does two-handle ranges), the apps here all want a single number — so that is
// what goes in and comes out.
//
// <aufbau-slider> renders its own value readout (and the unit) inside its
// .slider-display, so the wrapper must NOT add a second one — the old version
// did, which is why every app kept hand-rolling a raw <input type=range>
// instead of using this component.

import { html } from './../vendors.js';

const single = value => Array.isArray(value) ? value[0] : Number(value);

function Slider ({
  label,
  value,
  min  = 0,
  max  = 100,
  step = 1,
  style,
  showButtons,   // +/- stepper buttons around the track
  editable,      // render the readout as an editable number field
  unit,
  onChange,
}) {
  const isFloat  = step < 1;
  const decimals = step < 0.01 ? 4 : 2;
  const clamp    = v => Math.min(max, Math.max(min, v));
  const disp     = isFloat ? +Number(value).toFixed(decimals) : Math.round(value);     
  const set      = value => onChange?.(clamp(value));
  const onInput  = event => set(single(event.detail?.value ?? event.target?.value));

  return html`
    <div class="slider-row">
      ${label && html`<span class="slider-label">${label}</span>`}

      <div class="slider-track" style=${style}>
        <aufbau-slider
          controls=${showButtons}
          ...${{ editable, step, unit, onInput }}
          min=${String(min)}
          max=${String(max)}
          value=${String(disp)}
        ></aufbau-slider>
      </div>
    </div>`;
}

export       { Slider };
export default Slider;
