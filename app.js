// app.js — the launcher
//
// renders the app list from apps/registry.js. this replaces index.php, which
// used to scan the directory and build the same list server-side.

import { html, signal, computed } from '@aufbau/kits/preact-htm';

import { boot } from './shared/js/app.js';
import { registry, categories } from './apps/registry.js';
import Icon from './shared/js/components/Icon.js';
import Nav  from './shared/js/components/Nav.js';

const config = {
  app    : { slug: 'zugriff', name: 'zugriff apps', theme: 'dracula', lang: 'en' },
  aufbau : { elements: { mode: 'auto' } },
};

const query    = signal('');
const category = signal('');

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  const c = category.value;

  return registry.filter(app =>
    (!c || app.categories?.includes(c)) &&
    (!q || app.name.toLowerCase().includes(q) || app.description?.toLowerCase().includes(q))
  );
});

function AppList () {
  const list = visible.value;

  return html`
    <div id="app-body">

      <div class="search-row launcher-search">
        <${Icon} name="mdi:magnify" className="search-icon" />
        <input
          class="search-input"
          type="search"
          placeholder="Filter apps…"
          value=${query.value}
          onInput=${event => query.value = event.target.value}
        />
        ${query.value && html`
          <button class="act-btn" onClick=${() => query.value = ''}>
            <${Icon} name="mdi:close" />
          </button>`}
      </div>

      <div class="launcher-categories">
        <button class=${'chip' + (category.value === '' ? ' active' : '')}
                onClick=${() => category.value = ''}>all</button>
        ${categories.map(name => html`
          <button class=${'chip' + (category.value === name ? ' active' : '')}
                  onClick=${() => category.value = name}>${name}</button>`)}
      </div>

      <ul id="apps">
        ${list.map(app => html`
          <li key=${app.slug}>
            <a href=${`./apps/${app.slug}/`}>
              <span class="title">
                <span class="name">${app.name}</span>
                ${app.description && html`<span class="desc">${app.description}</span>`}
              </span>
              <span class="logo"><${Icon} name=${app.icon} /></span>
            </a>
          </li>`)}
      </ul>

      ${!list.length && html`<p class="launcher-empty">nothing matches “${query.value}”.</p>`}

    </div>`;
}

function Launcher () {
  return html`
    <div id="app-head">
      <div id="app-logo"><strong>zugriff</strong> apps</div>
      <${Nav} here='apps' base='./' />
    </div>

    <${AppList} />
  `;
}

// the launcher draws its own header, so it skips the app shell
boot({ config, App: Launcher, shell: false });
