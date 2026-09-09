// components/ActionMenu.js
// a horizontal bar of actions — the toolbar counterpart to ContextMenu. each
// item is a button, or an outbound link when it carries an href. `primary`
// marks the main action, `active` a toggle that is currently on, `iconOnly`
// drops the visible label down to a tooltip.

import { html } from './../vendors.js';
import Icon     from './Icon.js';
import Button   from './Button.js';

function ActionMenuItem ({ icon, label, active, primary, iconOnly, href, ...rest }) {
  const cls = ['ActionMenuItem', primary && 'primary', active && 'active'].filter(Boolean).join(' ');

  // an href makes the item an outbound link instead of a button
  if (href) {
    return html`
      <a class=${cls} href=${href} target='_blank' rel='noopener' title=${label}>
        ${icon && html`<${Icon} name=${icon} />`}
        ${!iconOnly && label}
      </a>`;
  }

  return html`
    <${Button}
      class=${cls}
      icon=${icon}
      label=${iconOnly ? null : label}
      title=${iconOnly ? label : null}
      ...${rest}
    />`;
}

function ActionMenu ({ items, ...rest }) {
  return html`
    <div class='ActionMenu' ...${rest}>
      ${items.map(ActionMenuItem)}
    </div>
  `;
}

export { ActionMenu, ActionMenuItem };
export default ActionMenu;
