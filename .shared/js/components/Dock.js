// Dock.js

import Button from './Button.js';

function DockNavItem ({ icon, label, dialog, panel, route, view, onClick, ...rest }) {
  if (dialog) onClick = () => zugriff.app.toggleDialog(dialog);
  if (panel)  onClick = () => zugriff.app.togglePanel(panel);
  if (route)  onClick = () => zugriff.app.go(route); // go(route)
  if (view)   onClick = () => zugriff.app.go(view);
  
  return html`<${Button} class='DockNavItem col' ...${{ icon, label, onClick, ...rest }} />`;
}

function Dock ({ items = [], ...rest }) {
  return html`
    <aside class='Dock' id='app-dock' ...${rest}>
      ${items.map(DockNavItem)}
    </aside>
  `;
}

export { Dock, DockNavItem };
export default Dock;


