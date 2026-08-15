// shared/js/components/Picker.js
//
// wraps <aufbau-picker look='segments'>. options are either plain strings or
// { value, label, icon, title } objects, exactly like before.

import { html, useEffect, useRef } from '@aufbau/kits/preact-htm';

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
  const ref     = useRef(null);

  const change = event => {
    const next = event.detail?.value ?? event.target?.value;
    if (sig) sig.value = next;
    onChange?.(next);
  };

  // upstream workaround for <aufbau-picker look='combobox'>. two bugs meet in
  // its open/close pair once the popover api is available:
  //
  //   isOpen  = list.matches(':popover-open') || !list.hidden
  //   setOpen = showPopover() … and never clears `hidden`
  //
  // so a fresh list reports itself as open (nothing has set `hidden` yet) and
  // the first click closes it, which finally sets `hidden` — after which
  // showPopover() does open the popover but `hidden` keeps it at display:none
  // for good. mirroring `hidden` onto the popover's own state fixes both: the
  // flag is then always exactly what the element assumes it is.
  useEffect(() => {
    if (look !== 'combobox') return;
    let cancelled = false;

    const attach = () => {
      const list = ref.current?.querySelector('.picker-list');
      if (cancelled || !list || list.__zugriffSynced) return;

      list.__zugriffSynced = true;
      list.hidden = !list.matches(':popover-open');
      list.addEventListener('toggle', event => { list.hidden = event.newState !== 'open'; });
    };

    attach();
    // the element is lazy loaded, so on the first render the list does not
    // exist yet — try again once the definition has landed and it upgraded
    customElements.whenDefined('aufbau-picker').then(attach);

    return () => { cancelled = true; };
  });

  return html`
    <aufbau-picker ref=${ref} class='picker' look=${look} multiple=${multiple} value=${current} onChange=${change}>
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
