// shared/js/components/Slider.js
//
// wraps <aufbau-slider>. the element carries its value as an array (it also
// does two-handle ranges), the apps here all want a single number — so that is
// what goes in and comes out.

import { html } from '@aufbau/kits/preact-htm';

const single = value => Array.isArray(value) ? value[0] : Number(value);

export default function Slider ({
  label,
  value,
  min  = 0,
  max  = 100,
  step = 1,
  style,
  showButtons,
  showNumber,
  unit,
  onChange,
}) {
  const isFloat  = step < 1;
  const decimals = step < 0.01 ? 4 : 2;
  const clamp    = v => Math.min(max, Math.max(min, v));
  const disp     = isFloat ? +Number(value).toFixed(decimals) : Math.round(value);
  const width    = (String(max).replace('.', '').length + (isFloat ? 2 : 0)) + 'ch';

  const set   = v => onChange?.(clamp(v));
  const input = event => set(single(event.detail?.value ?? event.target?.value));

  return html`
    <div class="slider-row">
      ${label && html`<span class="slider-label">${label}</span>`}

      <div class="slider-track" style=${style}>
        <aufbau-slider
          controls=${showButtons}
          editable=${showNumber}
          min=${String(min)}
          max=${String(max)}
          step=${step}
          unit=${unit}
          value=${String(disp)}
          onInput=${input}
        ></aufbau-slider>
      </div>

      ${showNumber && html`<span class="slider-value" style=${{ width }}>${disp}${unit ?? ''}</span>`}
    </div>`;
}
