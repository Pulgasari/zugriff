// components/ContextMenu.js


function ContextMenuItem ({ icon, label, onClick, ...rest }) {
  return html`<btn-tap class='ContextMenuItem' ...${{ icon, label, onClick, ...rest }} />`;
}

function ContextMenu ({ items, ...rest }) {
  return html`
    <div class='ContextMenu' ...${rest}>
      ${items.map(ContextMenuItem)}
    </div>
  `;
}

export { ContextMenu, ContextMenuItem };
export default ContextMenu;
