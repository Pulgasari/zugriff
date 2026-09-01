// AppNav.js

import AppNavItem from './AppNavItem.js';

const items = [
  { title: 'Episodes', icon: 'mdi:playlist-play',     onClick: () => toggleView('episodes') },
  { title: 'Podcasts', icon: 'mdi:view-grid-outline', onClick: () => toggleView('podcasts') },
  { title: 'Later',    icon: 'mdi:bookmark-outline',  onClick: () => toggleView('episodes') },
];

function toggleView (id) {

}

<button class="nav-item" onClick=${() => dialog.value = 'settings'}>
          <${Icon} name="mdi:cog-outline" /> <span>Settings</span></button>

function Sidebar () {
  return html`
    <aside id='app-nav'>
      <div class="brand"><${Icon} name="mdi:podcast" /> <span>Podcasts</span></div>

      <nav class="nav">
        <${NavItem} icon="mdi:playlist-play"     label="Latest"       name="latest" />
        <${NavItem} icon="mdi:view-grid-outline" label="Podcasts"     name="podcasts" count=${db.podcasts.value.length} />
        <${NavItem} icon="mdi:bookmark-outline"  label="Listen later" name="saved"    count=${saved} />
      </nav>

    </aside>`;
}

export       { AppNav };
export default AppNav;
