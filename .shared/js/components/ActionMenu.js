// components/ActionMenu.js

// a horizontal bar of actions — the toolbar counterpart to ContextMenu. each
// item is a button, or an outbound link when it carries an href. `primary`
// marks the main action, `active` a toggle that is currently on, `iconOnly`
// drops the visible label down to a tooltip.

import Button from './Button.js';
import Icon   from './Icon.js';
import Link   from './Link.js';

function ActionMenuItem ({ href, ...rest }) {
  //rest.className = ['ActionMenuItem'].filter(Boolean).join(' ');
  return href ? html`<${Link}   href=${href} ...${rest}>`
                html`<${Button} ...${rest}>`
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
