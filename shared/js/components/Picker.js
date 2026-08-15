// shared/js/components/Picker.js
//
// wraps <aufbau-picker look='segments'>. options are either plain strings or
// { value, label, icon, title } objects, exactly like before.

import { html } from '@aufbau/kits/preact-htm';

const isObject = v => typeof v === 'object' && v !== null;

export const normalize = opt => isObject(opt)
  ? {
      value : opt.value,
      label : opt.label ?? (opt.icon ? '' : String(opt.value)),
      icon  : opt.icon ?? null,
      title : opt.title ?? opt.label ?? String(opt.value),
    }
  : { value: opt, label: String(opt), icon: null, title: String(opt) };

export default function Picker ({ options = [], sig, value, onChange, look = 'segments', multiple }) {
  const current = sig ? sig.value : value;

  const change = event => {
    const next = event.detail?.value ?? event.target?.value;
    if (sig) sig.value = next;
    onChange?.(next);
  };

  return html`
    <aufbau-picker class='picker' look=${look} multiple=${multiple} value=${current} onChange=${change}>
      ${options.map(normalize).map(opt => html`
        <aufbau-option
          key=${opt.value}
          value=${opt.value}
          label=${opt.label}
          icon=${opt.icon}
          title=${opt.title}
        ></aufbau-option>`)}
    </aufbau-picker>`;
}
