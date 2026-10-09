// Dock.js

import { useRef } from './../vendors.js';


// an item is active while the current view is its own or one of `match`, e.g. a
// detail view that belongs to its list: { view: 'podcasts', match: ['podcast'] }
function DockNavItem ({ icon, label, dialog, panel, route, view, match = [], current, onClick, ...rest }) {
  if (dialog) onClick = () => zugriff.app.toggleDialog(dialog);
  if (panel)  onClick = () => zugriff.app.togglePanel(panel);
  if (route)  onClick = () => zugriff.app.go(route); // go(route)
  if (view)   onClick = () => zugriff.app.go(view);

  const active = current != null && [view ?? route, ...match].includes(current);

  return html`<btn-tap class=${active ? 'col active' : 'col'} aria-current=${active ? 'page' : null} ...${{ icon, label, onClick, ...rest }} />`;
}

const ownsView = (item, name) => [item.view ?? item.route, ...(item.match ?? [])].includes(name);

// `current` is the view on screen, app.current or the route's name when not given. a
// view no item owns (a detail) keeps the item that was active before it
function Dock ({ items = [], current, ...rest }) {
  const app  = zugriff.app;
  const last = useRef(null);
  const name = current ?? app?.current?.value ?? app?.state?.$route?.name;

  if (name != null && items.some(item => ownsView(item, name))) last.current = name;

  return html`
    <aside class='Dock dock' id='app-dock' ...${rest}>
      ${items.map(item => DockNavItem({ ...item, current: last.current }))}
    </aside>
  `;
}

export { Dock, DockNavItem };
export default Dock;


