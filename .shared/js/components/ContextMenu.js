// components/ContextMenu.js

import ContextMenuItem from './ContextMenuItem.js';

function ContextMenu ({ items, ...rest }) {
  return html`
    <div class='ContextMenu' ...${rest}>
      ${items.map(ContextMenuItem)}
    </div>
  `;
}

export default ContextMenu;
