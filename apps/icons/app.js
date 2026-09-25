// icons :: app.js

// an Iconify browser: every set, every icon, search, favourites. 
// the grid renders through the <iconify-icon> webcomponent 
// so a page of hundreds of icons is a couple of batched requests;
// the app's own chrome uses the shared aufbau-icon <Icon>. 
// data comes from api.iconify.design (modules/iconify.js),
// favourites from @bunker/db (modules/db.js).

// ::: vendors
import { computed, signal, typedSignal } from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';
import createElement from '@domina/methods/createElement.js';

const // ::: shared components
ActionMenu = await zugriff.component('ActionMenu'),
Button     = await zugriff.component('Button'),
Dock       = await zugriff.component('Dock'),
Empty      = await zugriff.component('Empty'),
Icon       = await zugriff.component('Icon'),
IconButton = await zugriff.component('IconButton'),
Loading    = await zugriff.component('Loading'),
Settings   = await zugriff.component('Settings');

// ::: the app handle
const app = zugriff.app;
app.api = await app.module('iconify');
app.db  = await app.module('db');

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::
// ui navigation on app.state (deep signal, no `.value`). the api results (collections /
// set / search) stay as plain signals — a set is thousands of names, better not deep-wrapped.

app.state.route     = { name: 'home', id: null };   // home | sets | set | search | favorites
app.state.$extend({
  nav       : { type: 'scalar', value: false },   // mobile drawer
  detail    : { type: 'scalar', value: null },    // selected icon name | null
  setFilter : { type: 'scalar', value: '' },      // filter on the sets list
  query     : { type: 'scalar', value: '' },      // search box
});

const collections = signal(null);   // [{ prefix, name, total, … }] | null
const setData     = signal(null);   // { prefix, title, total, icons } for route 'set'
const setLoading  = signal(false);
const results     = signal([]);
const searching   = signal(false);
const itemSize    = typedSignal({ value: 88, key: 'icons:item-size' }); // persisted grid zoom

// :::::: DATA :::::::::::::::::::::::::::::::::::::::::::::::

async function ensureCollections () {
  if (collections.value) return;
  try   { collections.value = await app.api.collections(); }
  catch { collections.value = []; app.toast({ error: 'Could not reach the Iconify API' }); }
}

async function openSet (prefix) {
  app.go('set', prefix);
  setData.value = null;
  setLoading.value = true;
  try     { setData.value = await api.collection(prefix); }
  catch   { app.toast({ error: 'Could not load that set' }); }
  finally { setLoading.value = false; }
}

let searchTimer = null;
function onSearch (value) {
  app.state.query = value;
  clearTimeout(searchTimer);
  const q = value.trim();
  if (!q) { results.value = []; searching.value = false; return; }
  searching.value = true;
  searchTimer = setTimeout(async () => {
    try     { results.value = await app.api.search(q); }
    catch   { app.toast({ error: 'Search failed' }); }
    finally { searching.value = false; }
  }, 250);
}

// :::::: ACTIONS + HOTKEYS ::::::::::::::::::::::::::::::::::
// escape backs out of the open sheet, then the mobile drawer

app.actions = { 'dismiss': () => { if (app.state.$detail) app.state.detail = null; else app.state.nav = false; } };
app.hotKeys = { 'escape': { action: 'dismiss', global: true } };

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const nfmt = n => n?.toLocaleString?.() ?? String(n ?? 0);

const filteredSets = computed(() => {
  const list = collections.value || [];
  const q = app.state.$setFilter.trim().toLowerCase();
  return q ? list.filter(c => c.name.toLowerCase().includes(q) || c.prefix.toLowerCase().includes(q)) : list;
});

async function copy (text) {
  try {
    await navigator.clipboard.writeText(text);
    app.toast({ success: 'Copied' });
  }
  catch { app.toast({ error: 'Copy failed' }); }
}
/*
const copySvg = (name) => {
  const text = await app.api.svgText(name);
  copy(text);
};
*/
async function copySvg (name) {
  try {
    const text = await app.api.svgText(name);
    await navigator.clipboard.writeText(text);
    app.toast({ success: 'SVG copied' });
  }
  catch { app.toast({ error: 'Could not copy the SVG' }); }
}
async function downloadSvg (name) {
  try {
    const blob = new Blob([await app.api.svgText(name)], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const a    = createElement('a', { href, download: name.replace(':', '-') + '.svg' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } 
  catch { app.toast({ error: 'Could not download the SVG' }); }
}

const z = {};
z.clipboard = {};

// :::::: COMPONENTS ::::::::::::::::::::::::::::::::::::::::

// the icon svg itself, via the batching/caching web component
const IconGlyph = ({ name }) => html`<iconify-icon icon=${name}></iconify-icon>`;

function IconCell ({ name }) {
  const fav = app.db.favs.value.has(name);
  return html`
    <button class="cell" onClick=${() => app.state.detail = name} title=${name}>
      <span class="glyph"><${IconGlyph} name=${name} /></span>
      <span class="cname">${name.split(':')[1]}</span>
      <${Button}
        class=${'heart' + (fav ? ' on' : '')}
        icon=${fav ? 'heart' : 'heart-outline'}
        title="Favourite"
        onClick=${e => { e.stopPropagation(); app.db.toggleFav(name); }}
      />
    </button>
  `;
}

function IconGrid ({ names }) {
  const ref = useRef(null);

  useEffect(() => {
    let handle;
    import('@aufbau/gestures')
      .then(g => { if (ref.current) handle = g.compose(ref.current, { onAdjust: v => itemSize.value = Math.round(v), value: itemSize.value, min: 56, max: 200 }); })
      .catch(() => {});
    return () => handle?.destroy();
  }, []);

  if (!names.length) return html`<${Empty} icon="image-search" title="Nothing here." />`;
  return html`
    <div class="grid" ref=${ref} style=${`--isz:${itemSize.value}px`}>
      ${names.map(n => html`<${IconCell} key=${n} name=${n} />`)}
    </div>
  `;
}

// ── views ────────────────────────────────────────────────────────────────

function HomeView () {
  const list = collections.value;
  const sets = list?.length ?? 0;
  const total = (list || []).reduce((n, c) => n + (c.total || 0), 0);
  return html`
    <div class="home">
      <div class="hero">
        <${Icon} name="mdi:emoticon-outline" />
        <h1>The whole Iconify library</h1>
        <p>${list ? `Browse ${nfmt(total)} icons across ${nfmt(sets)} sets.` : 'Loading the catalogue…'}</p>
        <div class="hero-actions">
          <${Button} icon='images' label='browse sets' onClick=${() => { ensureCollections(); app.go('sets'); }} />
          <${Button} icon='search' label='search'      onClick=${() => app.go('search')} />
        </div>
      </div>
      ${list && list.length > 0 && html`
        <div class="home-sets">
          <div class="home-sets-head">Popular sets</div>
          <div class="chips">
            ${['mdi', 'material-symbols', 'lucide', 'ph', 'tabler', 'bi', 'fa6-solid', 'ri', 'carbon', 'solar']
              .map(p => list.find(c => c.prefix === p)).filter(Boolean)
              .map(c => html`<button class="chip" key=${c.prefix} onClick=${() => openSet(c.prefix)}>${c.name} <span>${nfmt(c.total)}</span></button>`)}
          </div>
        </div>`}
    </div>
  `;
}

function SetsView () {
  if (!collections.value) return html`<${Loading}/>`;
  const rows = filteredSets.value;
  return html`
    <div class="sets">
      ${rows.map(c => html`
        <button class="set-card" key=${c.prefix} onClick=${() => openSet(c.prefix)}>
          <div class="set-samples">
            ${(c.samples.length ? c.samples : ['']).slice(0, 3).map(s => s ? html`<iconify-icon key=${s} icon=${`${c.prefix}:${s}`}></iconify-icon>` : '')}
          </div>
          <div class="set-name" title=${c.name}>${c.name}</div>
          <div class="set-meta">${nfmt(c.total)} icons${c.author ? ` · ${c.author}` : ''}</div>
        </button>`)}
      ${!rows.length && html`<${Empty} icon='image-search' title="Nothing here." />`}
    </div>`;
}

function SetView () {
  const d = setData.value;
  if (setLoading.value || !d) return html`<${Loading}/>`;
  return html`
    <div class="setview">
      <header>
        <div>
          <h1>${d.title}</h1>
          <div class="sub">${nfmt(d.total)} icons · <code>${d.prefix}</code></div>
        </div>
        <${Button} class='small' icon='copy' label='copy prefix' onClick=${() => copy(d.prefix)} />
      </header>
      <${IconGrid} names=${d.icons} />
    </div>`;
}

function SearchView () {
  return html`
    <div class="searchview">
      ${searching.value ? html`<${Loading}/>`
        : app.state.$query.trim() ? html`<${IconGrid} names=${results.value} />`
        : html`<${Empty} icon='search' hint='Search across every Iconify set.' />`}
    </div>
  `;
}

function FavoritesView () {
  const names = [...db.favs.value];
  return names.length
    ? html`<${IconGrid} names=${names} />`
    : html`<${Empty} icon='heart' hint='No favourites yet — tap the heart on any icon.' />`;
}

function Content () {
  switch (app.state.$route.name) {
    case 'sets':      return html`<${SetsView} />`;
    case 'set':       return html`<${SetView} />`;
    case 'search':    return html`<${SearchView} />`;
    case 'favorites': return html`<${FavoritesView} />`;
    default:          return html`<${HomeView} />`;
  }
}

/*
app.views = {
  home   : 'HomeView',
  favs   : 'FavoritesView',
  search : 'SearchView',
  set    : 'SetView',
  sets   : 'SetsView',
};
*/

// ── top bar ──────────────────────────────────────────────────────────────

function SizeControl () {
  return html`
    <div class="size">
      <${Icon} name='zoom-out' />
      <input type="range" min="56" max="200" step="1" value=${itemSize.value} onInput=${e => itemSize.value = +e.target.value} />
      <${Icon} name='zoom-in' />
    </div>
  `;
}

function TopBar () {
  const r = app.state.$route;
  const grid = r.name === 'set' || r.name === 'search' || r.name === 'favorites';
  return html`
    <header class="topbar">
      <${IconButton} aria-label="Menu" icon='menu' onClick=${() => app.state.nav = true} />
      ${r.name === 'set' && html`<${IconButton} icon="arrow-left" label="Back" onClick=${() => app.go('sets')} />`}

      ${r.name === 'search'
        ? html`<div class="searchbox big">
            <${Icon} name='search' />
            <input type="search" placeholder="Search all of Iconify…" autofocus value=${app.state.$query} onInput=${e => onSearch(e.target.value)} />
          </div>`
        : r.name === 'sets'
        ? html`<div class="searchbox">
            <${Icon} name='search' />
            <input type="search" placeholder="Filter sets…" value=${app.state.$setFilter} onInput=${e => app.state.setFilter = e.target.value} />
          </div>`
        : html`<h1>${r.name === 'favorites' ? 'Favourites' : 'Icons'}</h1>`}

      <span class="spacer"></span>
      ${grid && html`<${SizeControl} />`}
      <${Settings} />
    </header>`;
}

// ── detail sheet ─────────────────────────────────────────────────────────

function Detail () {
  const name = app.state.$detail;
  if (!name) return null;
  const [prefix, icon] = name.split(':');
  const fav = app.db.favs.value.has(name);
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) app.state.detail = null; }}>
      <div class="sheet" role="dialog" aria-modal="true">
        <button class="sheet-x" aria-label="Close" onClick=${() => app.state.detail = null}><${Icon} name="mdi:close" /></button>
        <div class="sheet-preview"><iconify-icon icon=${name}></iconify-icon></div>
        <div class="sheet-name">${icon}</div>
        <div class="sheet-set"><button class="linkish" onClick=${() => { app.state.detail = null; openSet(prefix); }}>${prefix}</button></div>
        <div class="sheet-actions">
          <${Button} icon='copy'     label='copy name' onClick=${() => copy        (name)} />
          <${Button} icon='svg'      label='copy svg'  onClick=${() => copySvg     (name)} />
          <${Button} icon='download' label='download'  onClick=${() => downloadSvg (name)} />
          <${Button}
            icon=${fav ? 'heart' : 'heart-outline'}
            label=${fav ? 'Favourited' : 'Favourite'}
            onClick=${() => app.db.toggleFav(name)}
          />
        </div>
      </div>
    </div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { icon: 'mdi:home', label: 'home',   view: 'home'   },
  { icon: 'search',   label: 'search', view: 'search' },
  { icon: 'images',   label: 'sets',   view: 'sets'   },
  { icon: 'heart',    label: 'favs',   view: 'favs'   },
];

function App () {
  useEffect(() => {
    app.db.loadFavs().catch(() => {});
    ensureCollections(); // warms the catalogue for home stats + sets
  }, []);

  return html`<>
    <main id='app-main'>
      <${Content}/>
    </main>
    <${Dock} items=${dockItems} />
  </>`;
}

// :::::: BOOT

app.init({ App });
