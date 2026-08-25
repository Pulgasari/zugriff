// apps/app.js — the apps overview
// this renders shared/js/registry.js (type: 'app')

// :::::: IMPORTS

import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

import { boot }     from './../shared/js/app.js';
import { registry } from './../shared/js/registry.js';
import Icon         from './../shared/js/components/Icon.js';
import Nav          from './../shared/js/components/Nav.js';
import Settings, { SettingsButton } from './../shared/js/components/Settings.js';
import { launcher, themeGroup } from './../shared/js/lib/settings.js';

// :::::: CONFIG

const categories = registry.categories('app');
const config     = { slug: 'apps', name: 'zugriff apps', theme: 'dracula', lang: 'en', aufbau: { elements: { mode: 'auto' } } };    
const groups     = [ { title: 'launcher', settings: launcher }, themeGroup ];

// :::::: STATES

const query    = signal('');
const category = signal('');

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  const c = category.value;

  return registry.getAll('app').filter(app =>
    (!c || app.categories?.includes(c)) &&
    (!q || app.name.toLowerCase().includes(q) || app.description?.toLowerCase().includes(q))
  );
});

// :::::: COMPONENTS

function Filter () {
  const ref      = useRef(null);
  const sticky   = launcher.value('filter-sticky');
  const position = launcher.value('filter-position');

  useEffect(() => {
    if (launcher.value('filter-autofocus')) ref.current?.focus();
  }, []);

  return html`
    <div class=${['search-row launcher-search', sticky && 'sticky', position].filter(Boolean).join(' ')}>
      <${Icon} name="mdi:magnify" className="search-icon" />
      <input
        ref=${ref}
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
    </div>`;
}

function AppList () {
  const list = visible.value;
  const top  = launcher.value('filter-position') === 'top';

  return html`
    <div id="app-body">

      ${top && html`<${Filter} />`}

      <div class="launcher-categories">
        <button class=${'chip' + (category.value === '' ? ' active' : '')}
                onClick=${() => category.value = ''}>all</button>
        ${categories.map(name => html`
          <button class=${'chip' + (category.value === name ? ' active' : '')}
                  onClick=${() => category.value = name}>${name}</button>`)}
      </div>

      <ul id="tools">
        ${list.map(app => html`
          <li key=${app.slug}>
            <a href=${`./${app.slug}/`}>
              <span class="title">
                <span class="name">${app.name}</span>
                ${app.description && html`<span class="desc">${app.description}</span>`}
              </span>
              <span class="logo"><${Icon} name=${app.icon} /></span>
            </a>
          </li>`)}
      </ul>

      ${!list.length && html`<p class="launcher-empty">nothing matches “${query.value}”.</p>`}

      ${!top && html`<${Filter} />`}

    </div>`;
}

function Launcher () {
  return html`
    <div id="app-head">
      <div id="app-logo"><strong>zugriff</strong> apps</div>
      <div class="actions">
        <${Nav} here='apps' base='./../' />
        <${SettingsButton} />
      </div>
    </div>

    <${Settings} groups=${groups} />

    <${AppList} />
  `;
}

// :::::: BOOT

boot({ config, App: Launcher, shell: false });
