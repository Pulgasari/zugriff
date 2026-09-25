// components/Picker.js

import { html } from './../vendors.js';

const isObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);

const normalize = opt => {
  if (Array.isArray(opt)) {
    const [value, label = String(value)] = opt;
    return { value, label, icon: null, title: label };
  }
  if (isObject(opt)) return {
    value : opt.value,
    label : opt.label ?? (opt.icon ? '' : String(opt.value)),
    icon  : opt.icon  ?? null,
    title : opt.title ?? opt.label ?? String(opt.value),
  };
  return { value: opt, label: String(opt), icon: null, title: String(opt) };
};

function Option ({ icon, label, title, value }) {
  return html`
    <aufbau-option
      key=${value}
      ...${{ icon, label, title, value }}
    ></aufbau-option>
  `;
}

// `src` is a file of options the element loads for itself (json/csv/yaml
// — see @aufbau/import); `options` and `src` can be used together, the loaded ones come last.      
function Picker ({ options = [], sig, signal, onChange, searchable, value, ...rest }) {
  if (sig) signal = sig; // const current = signal ? signal.value : value;
  
  if (signal) value   = signal.value;
  if (signal) options = signal.values;

  const change = event => {
    const next = event.detail?.value ?? event.target?.value;
    if (signal) signal.value = next;
    onChange?.(next);
  };

  return html`
    <aufbau-picker
      searchable=${searchable || undefined}
      onChange=${change}
      ...${{ look, multiple, placeholder, src, value, ...rest }}
    >
      ${options.map(normalize).map(Option)}
    </aufbau-picker>
  `;
}

export       { Picker, normalize };
export default Picker;
