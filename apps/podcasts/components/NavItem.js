// apps/podcasts/components/NavItem.js
// one sidebar nav entry — active when the route matches (a podcast detail counts as
// the podcasts section).

import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;
const { go } = app;
const { route } = app.ui;

export default function NavItem ({ icon, label, name, count }) {
  const active = route.value.name === name || (name === 'podcasts' && route.value.name === 'podcast');

  return html`
    <button class=${'nav-item' + (active ? ' active' : '')} onClick=${() => go(name)}>
      <${Icon} name=${icon} /> <span>${label}</span>
      ${count != null && count > 0 && html`<span class="nav-count">${count}</span>`}
    </button>
  `;
}
