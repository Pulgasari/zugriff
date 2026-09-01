// AppNav.js

import { html } from './../vendors.js';
import Button   from './Button.js';

const items = [
  { title: 'Episodes', icon: 'mdi:playlist-play',     route: 'episodes' },
  { title: 'Podcasts', icon: 'mdi:view-grid-outline', route: 'podcasts' },
  { title: 'Later',    icon: 'mdi:bookmark-outline',  route: 'episodes' },     
  { title: 'Settings', icon: 'settings',             dialog: 'settings' },
];


function AppNavItem ({ icon, label, dialog, panel, route, onClick, ...rest }) {
  if (dialog) onClick = () => zugriff.app.toggleDialog(dialog);
  if (panel)  onClick = () => zugriff.app.togglePanel(panel);
  if (route)  onClick = () => zugriff.app.openRoute(route); // go(route)
  
  return html`
    <${Button} class='item' onClick=${onClick}>
      <${Icon} name=${icon} /> <span>${label}</span>
    </${Button}>
  `;
}

function AppNav ({ items, ...rest }) {
  return html`
    <aside id='app-nav'>
      <nav>
        {items.forEach(AppNavItem)}
      </nav>
    </aside>
  `;
}

export       { AppNav, AppNavItem };
export default AppNav;



