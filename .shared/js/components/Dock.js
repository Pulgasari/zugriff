// Dock.js

import Button from './Button.js';

// an item is active while the current view is its own or one of `match`, e.g. a
// detail view that belongs to its list: { view: 'podcasts', match: ['podcast'] }
function DockNavItem ({ icon, label, dialog, panel, route, view, match = [], current, onClick, ...rest }) {
  if (dialog) onClick = () => zugriff.app.toggleDialog(dialog);
  if (panel)  onClick = () => zugriff.app.togglePanel(panel);
  if (route)  onClick = () => zugriff.app.go(route); // go(route)
  if (view)   onClick = () => zugriff.app.go(view);

  const active = current != null && [view ?? route, ...match].includes(current);

  return html`<${Button} class=${active ? 'col active' : 'col'} aria-current=${active ? 'page' : null} ...${{ icon, label, onClick, ...rest }} />`;
}

// `current` is the view on screen, the route's name when not given
function Dock ({ items = [], current = zugriff.app?.state?.$route?.name, ...rest }) {
  return html`
    <aside class='Dock dock' id='app-dock' ...${rest}>
      ${items.map(item => DockNavItem({ ...item, current }))}
    </aside>
  `;
}

export { Dock, DockNavItem };
export default Dock;


