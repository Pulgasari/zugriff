// apps/podcasts/panels/SidebarPanel.js
// the navigation sidebar: brand, the section nav and a footer with settings + links.

import Icon    from '/.shared/js/components/Icon.js';
import NavItem from './../components/NavItem.js';

const app = zugriff.app;
const { db } = app;

export default function SidebarPanel () {
  const saved = db.savedEpisodes.value.length;
  return html`
    <aside class="sidebar">
      <div class="brand"><${Icon} name="mdi:podcast" /> <span>Podcasts</span></div>

      <nav class="nav">
        <${NavItem} icon="mdi:playlist-play"     label="Latest"       name="latest" />
        <${NavItem} icon="mdi:view-grid-outline" label="Podcasts"     name="podcasts" count=${db.podcasts.value.length} />
        <${NavItem} icon="mdi:bookmark-outline"  label="Listen later" name="saved"    count=${saved} />
      </nav>

      <div class="side-foot">
        <button class="nav-item" onClick=${() => app.state.dialog = 'settings'}>
          <${Icon} name="mdi:cog-outline" /> <span>Settings</span></button>
        <div class="side-links">
          <a href="./../"><${Icon} name="mdi:view-grid-outline" /> apps</a>
          <a href="./../../"><${Icon} name="mdi:home-outline" /> launcher</a>
        </div>
      </div>
    </aside>`;
}
