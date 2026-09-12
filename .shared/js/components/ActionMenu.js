// components/ActionMenu.js

// a horizontal bar of actions — the toolbar counterpart to ContextMenu. each
// item is a button, or an outbound link when it carries an href. `primary`
// marks the main action, `active` a toggle that is currently on, `iconOnly`
// drops the visible label down to a tooltip.

import Button from './Button.js';
import Icon   from './Icon.js';
import Link   from './Link.js';

const isFn = sth => typeof sth === 'function';

function ActionMenuItem (props) {
  //rest.className = ['ActionMenuItem'].filter(Boolean).join(' ');
  return isFn(props) ? props()
       : props.href  ? html`<${Link}   ...${props}>`
       :               html`<${Button} ...${props}>`;
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
