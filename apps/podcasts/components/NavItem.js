function NavItem ({ icon, label, name, count }) {
  const active = route.value.name === name || (name === 'podcasts' && route.value.name === 'podcast');
  
  return html`
    <button class=${'nav-item' + (active ? ' active' : '')} onClick=${() => go(name)}>
      <${Icon} name=${icon} /> <span>${label}</span>
      ${count != null && count > 0 && html`<span class="nav-count">${count}</span>`}
    </button>
  `;
}

export default NavItem;
