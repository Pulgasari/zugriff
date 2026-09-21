// components/ActionMenu.js

// a horizontal bar of actions — the toolbar counterpart to ContextMenu. each
// item is a button, or an outbound link when it carries an href. `primary`
// marks the main action, `active` a toggle that is currently on, `iconOnly`
// drops the visible label down to a tooltip.

import { isValidElement } from 'preact';

import Button from './Button.js';
import Icon   from './Icon.js';
import Link   from './Link.js';

const isFn = sth => typeof sth === 'function';

// an item is a spec ({ icon, label, onClick } — with an href it is an outbound
// link), or a component the caller has already rendered, which is handed through
function ActionMenuItem (props) {
  return isFn(props)           ? props()
       : isValidElement(props) ? props
       : props.href            ? html`<${Link}   ...${props} />`
       :                         html`<${Button} ...${props} />`;
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
