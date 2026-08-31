// apps/code/components/RowMenu.js
// a small "⋯" popover menu used on every tree row. `items` is a list of
// { label, icon, onClick, danger } (falsy entries are skipped).

import { html, useState } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function RowMenu ({ items }) {
  const [open, setOpen] = useState(false);
  const list = items.filter(Boolean);
  if (!list.length) return null;

  const run = fn => e => { e.stopPropagation(); setOpen(false); fn(); };

  return html`
    <span class="rowmenu">
      <button class="rowmenu-btn" title="Actions" onClick=${e => { e.stopPropagation(); setOpen(o => !o); }}>
        <${Icon} name="mdi:dots-horizontal" />
      </button>
      ${open && html`
        <div class="rowmenu-scrim" onClick=${e => { e.stopPropagation(); setOpen(false); }}></div>
        <div class="rowmenu-pop" onClick=${e => e.stopPropagation()}>
          ${list.map(it => html`
            <button class=${'rowmenu-item' + (it.danger ? ' danger' : '')} onClick=${run(it.onClick)}>
              ${it.icon && html`<${Icon} name=${it.icon} />`}<span>${it.label}</span>
            </button>`)}
        </div>`}
    </span>`;
}
