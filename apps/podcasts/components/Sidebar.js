// podcasts :: components/Sidebar.js

function Sidebar () {
  const saved = db.savedEpisodes.value.length;
  return html`
    <aside class="sidebar">
      <div class="brand"><${Icon} name="mdi:podcast" /> <span>Podcasts</span></div>

      <nav class="nav">
        <${NavItem} icon="mdi:playlist-play"   label="Latest"    name="latest" />
        <${NavItem} icon="mdi:view-grid-outline" label="Podcasts" name="podcasts" count=${db.podcasts.value.length} />
        <${NavItem} icon="mdi:bookmark-outline" label="Listen later" name="saved" count=${saved} />
      </nav>

      <div class="side-foot">
        <button class="nav-item" onClick=${() => dialog.value = 'settings'}>
          <${Icon} name="mdi:cog-outline" /> <span>Settings</span></button>
        <div class="side-links">
          <a href="./../"><${Icon} name="mdi:view-grid-outline" /> apps</a>
          <a href="./../../"><${Icon} name="mdi:home-outline" /> launcher</a>
        </div>
      </div>
    </aside>`;
}

export default Sidebar;
