// Dock.js

//import { html } from './../vendors.js';
import Button from './Button.js';

/*
const items = [
  { title: 'Episodes', icon: 'mdi:playlist-play',     route: 'episodes' },
  { title: 'Podcasts', icon: 'mdi:view-grid-outline', route: 'podcasts' },
  { title: 'Later',    icon: 'mdi:bookmark-outline',  route: 'episodes' },     
  { title: 'Settings', icon: 'settings',             dialog: 'settings' },
];
*/

function DockNavItem ({ icon, label, dialog, panel, route, onClick, ...rest }) {
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


