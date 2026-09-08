// .shared/js/launcher.js
// the launcher shell for the non-app routes (home / apps / tools).
// imported for its side effect by index.html once the runtime is ready; 
// it reads the route from the pathname and renders either the landing page (home) or the app/tool grid.

import zugriff               from './runtime.js';
import aufbau                from '@aufbau/runtime';
import { applyFilter }       from '@aufbau/filters';
import { animatePattern }    from '@aufbau/patterns';
import { computed, signal }  from '@aufbau/signals';
import getStyleToken         from '@domina/methods/getStyleToken.js';
import { render }            from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const route = window.location.pathname.split('/')[1] || 'home';

const // shared components
Button      = await zugriff.component('Button'),
GhostButton = await zugriff.component('GhostButton'),
Icon        = await zugriff.component('Icon'),
Nav         = await zugriff.component('Nav'),
Settings    = await zugriff.component('Settings');

// :::::: RENDER

// ::: Page: Home

if (route === 'home') {
  await aufbau.init({ css: { theme: 'zombie', layout: 'landing' }});

  const Menu = () => html`
    <nav>
      <a href="/cli/">CLI</a>
      <a href="/apps/">Apps</a>
      <a href="/tools/">Tools</a>
    </nav>
  `;

  function HomePage () { return html`
    <div id='app'>
      <header><${Menu}/></header>
      <svg id="welcome"><use href="logo.svg#logo"></use></svg>
      <footer><${Menu}/></footer>
    </div>
  `;}

  render(html`<${HomePage}/>`, document.body);
}

// ::: Page: Apps | Tools

else {
  await aufbau.init({ css: { theme: 'zombie' }});

  // :::::: CONFIG + STATES

  let page = {};
  if (route === 'apps') {
    page = { basePath: '', cat: 'app', name: 'zugriff apps', slug: 'apps' };
  }
  else if (route === 'tools') {
    page = { basePath: '/tools', cat: 'tool', name: 'zugriff tools', slug: 'tools' };
  }

  const categories = zugriff.registry.categories(page.cat);
  const config     = { slug: page.slug, name: page.name, theme: 'dracula', lang: 'en', aufbau: { elements: { mode: 'auto' } } };
  const query      = signal('');
  const category   = signal('');

  const visible = computed(() => {
    const q = query.value.trim().toLowerCase();
    const c = category.value;

    return zugriff.registry.getAll(page.cat).filter(app =>
      (!c || app.categories?.includes(c)) &&
      (!q || app.name.toLowerCase().includes(q) || app.description?.toLowerCase().includes(q))
    );
  });
  
  // :::::: COMPONENTS

  function Filter () {
    const ref      = useRef(null);
    const position = 'bottom';
    const sticky   = true;

    useEffect(() => {
      if (launcher.value('filter-autofocus')) ref.current?.focus();
    }, []);

    return html`
      <div class=${['search-row launcher-search', sticky && 'sticky', position].filter(Boolean).join(' ')}>
        <${Icon} name="search" className="search-icon" />
        <input
          ref=${ref}
          class="search-input"
          type="search"
          placeholder="type to filter …"
          value=${query.value}
          onInput=${event => query.value = event.target.value}
        />
        ${query.value && html`<${Button} icon="close" onClick=${() => query.value = ''}>`}
      </div>`;
  }

  function AppList () {
    const list = visible.value;
    const top  = false;

    return html`
      <div id="app-body">
        ${top && html`<${Filter} />`}

        <div class="launcher-categories">
          <button class=${'chip' + (category.value === '' ? ' active' : '')} onClick=${() => category.value = ''}>all</button>
          ${categories.map(name => html`<button class=${'chip' + (category.value === name ? ' active' : '')} onClick=${() => category.value = name}>${name}</button>`)}
        </div>

        <ul id="tools">
          ${list.map(app => html`
            <li key=${app.slug}>
              <a href=${`${page.basePath}/${app.slug}/`}>
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
        <div id="app-logo">${page.name}</div>
        <div class="actions">
          <${Nav} here='apps' base='./../' />
        </div>
      </div>
      <${AppList} />
    `;
  }

  // :::::: BOOT

  render(
    html`<${Launcher}/>`, 
    document.getElementById('app')
  );
}

// apply filter + pattern to <body>
const bg = getStyleToken('bg') || '#000000';
const fg = getStyleToken('fg') || '#c8d0e0';
applyFilter('body', 'glitch-live', { animate: true, speed: "2s" });
animatePattern(document.body, 'grid', { bg, fg: fg + '22', motion: 'up', speed: '1s', size: 44, width: 1 });
