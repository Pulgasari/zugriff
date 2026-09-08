// apps/icons/app.js
//
// an Iconify browser: every set, every icon, search, favourites. the grid renders through
// the <iconify-icon> web component (loaded by the shell for the icons route) so a page of
// hundreds of icons is a couple of batched requests; the app's own chrome uses the shared
// aufbau-icon <Icon>. data comes from api.iconify.design (modules/iconify.js), favourites
// from @bunker/db (modules/db.js). the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime.

// ::: vendors
import { signal, computed } from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';

// ::: shared
import { Icon, IconButton, Empty, Settings } from '/.shared/js/components/index.js';
import { stored } from '/.shared/js/app/signals.js';

// ::: app modules
import * as api from './modules/iconify.js';
import * as db  from './modules/db.js';

// ::: the app handle
const app = zugriff.app;
app.db = db;

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::
// ui navigation on app.state (deep signal, no `.value`). the api results (collections /
// set / search) stay as plain signals — a set is thousands of names, better not deep-wrapped.

app.state.route     = { name: 'home', id: null };   // home | sets | set | search | favorites
app.state.nav       = false;                          // mobile drawer
app.state.detail    = null;                           // selected icon name | null
app.state.setFilter = '';                             // filter on the sets list
app.state.query     = '';                             // search box

const collections = signal(null);   // [{ prefix, name, total, … }] | null
const setData     = signal(null);   // { prefix, title, total, icons } for route 'set'
const setLoading  = signal(false);
const results     = signal([]);
const searching   = signal(false);
const itemSize    = stored(88, 'icons:item-size');   // persisted grid zoom

app.go = (name, id = null) => { app.state.route = { name, id }; app.state.nav = false; };
const flash = text => app.toast(text);

// :::::: DATA :::::::::::::::::::::::::::::::::::::::::::::::

async function ensureCollections () {
  if (collections.value) return;
  try { collections.value = await api.collections(); }
  catch { collections.value = []; flash('Could not reach the Iconify API'); }
}

async function openSet (prefix) {
  app.go('set', prefix);
  setData.value = null;
  setLoading.value = true;
  try { setData.value = await api.collection(prefix); }
  catch { flash('Could not load that set'); }
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
    try { results.value = await api.search(q); }
    catch { flash('Search failed'); }
    finally { searching.value = false; }
  }, 250);
}

// :::::: ACTIONS + HOTKEYS ::::::::::::::::::::::::::::::::::
// escape backs out of the open sheet, then the mobile drawer

app.actions = { 'dismiss': () => { if (app.state.detail) app.state.detail = null; else app.state.nav = false; } };
app.hotKeys = { 'escape': { action: 'dismiss', global: true } };

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const nfmt = n => n?.toLocaleString?.() ?? String(n ?? 0);

const filteredSets = computed(() => {
  const list = collections.value || [];
  const q = app.state.setFilter.trim().toLowerCase();
  return q ? list.filter(c => c.name.toLowerCase().includes(q) || c.prefix.toLowerCase().includes(q)) : list;
});

async function copy (text) {
  try { await navigator.clipboard.writeText(text); flash('Copied'); }
  catch { flash('Copy failed'); }
}
async function copySvg (name) {
  try { await navigator.clipboard.writeText(await api.svgText(name)); flash('SVG copied'); }
  catch { flash('Could not copy the SVG'); }
}
async function downloadSvg (name) {
  try {
    const blob = new Blob([await api.svgText(name)], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name.replace(':', '-') + '.svg' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { flash('Could not download the SVG'); }
}

// :::::: COMPONENTS ::::::::::::::::::::::::::::::::::::::::

// the icon svg itself, via the batching/caching web component
const IconGlyph = ({ name }) => html`<iconify-icon icon=${name}></iconify-icon>`;

function IconCell ({ name }) {
  const fav = db.favs.value.has(name);
  return html`
    <button class="cell" onClick=${() => app.state.detail = name} title=${name}>
      <span class="glyph"><${IconGlyph} name=${name} /></span>
      <span class="cname">${name.split(':')[1]}</span>
      <button class=${'heart' + (fav ? ' on' : '')} title="Favourite"
              onClick=${e => { e.stopPropagation(); db.toggleFav(name); }}>
        <${Icon} name=${fav ? 'mdi:heart' : 'mdi:heart-outline'} />
      </button>
    </button>`;
}

function IconGrid ({ names }) {
  const ref = useRef(null);

  // resizable: two-finger + ctrl/⌘ wheel, best-effort (the slider always works)
  useEffect(() => {
    let handle;
    import('@aufbau/gestures')
      .then(g => { if (ref.current) handle = g.compose(ref.current, { onAdjust: v => itemSize.value = Math.round(v), value: itemSize.value, min: 56, max: 200 }); })
      .catch(() => {});
    return () => handle?.destroy();
  }, []);

  if (!names.length) return html`<${Empty} icon="mdi:image-search-outline" title="Nothing here." />`;
  return html`
    <div class="grid" ref=${ref} style=${`--isz:${itemSize.value}px`}>
      ${names.map(n => html`<${IconCell} key=${n} name=${n} />`)}
    </div>`;
}

// ── sidebar ──────────────────────────────────────────────────────────────

function NavItem ({ name, icon, label }) {
  return html`
    <button class=${'nav-item' + (app.state.route.name === name ? ' active' : '')} onClick=${() => name === 'sets' ? (ensureCollections(), app.go('sets')) : app.go(name)}>
      <${Icon} name=${icon} /> <span>${label}</span>
    </button>`;
}

function Sidebar () {
  return html`
    <aside class=${'sidebar' + (app.state.nav ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="mdi:emoticon-outline" /> <span>Icons</span>
        <button class="ibtn nav-close" aria-label="Close" onClick=${() => app.state.nav = false}><${Icon} name="mdi:close" /></button>
      </div>
      <nav class="nav-group">
        <${NavItem} name="home"      icon="mdi:home-outline"          label="Home" />
        <${NavItem} name="search"    icon="mdi:magnify"               label="Search" />
        <${NavItem} name="sets"      icon="mdi:image-multiple-outline" label="Sets" />
        <${NavItem} name="favorites" icon="mdi:heart-outline"         label="Favourites" />
      </nav>
      <div class="side-foot">
        <div class="side-links">
          <a href="./../"><${Icon} name="mdi:view-grid-outline" /> apps</a>
          <a href="./../../"><${Icon} name="mdi:home-outline" /> launcher</a>
        </div>
        <div class="powered">powered by <a href="https://iconify.design" target="_blank" rel="noopener">Iconify</a></div>
      </div>
    </aside>`;
}

// ── views ────────────────────────────────────────────────────────────────

function Home () {
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
          <button class="btn primary" onClick=${() => { ensureCollections(); app.go('sets'); }}><${Icon} name="mdi:image-multiple-outline" /> Browse sets</button>
          <button class="btn" onClick=${() => app.go('search')}><${Icon} name="mdi:magnify" /> Search</button>
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
    </div>`;
}

function SetsView () {
  if (!collections.value) return html`<div class="loading"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;
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
      ${!rows.length && html`<${Empty} icon="mdi:image-search-outline" title="Nothing here." />`}
    </div>`;
}

function SetView () {
  const d = setData.value;
  if (setLoading.value || !d) return html`<div class="loading"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;
  return html`
    <div class="setview">
      <header class="setview-head">
        <div>
          <h1>${d.title}</h1>
          <div class="sub">${nfmt(d.total)} icons · <code>${d.prefix}</code></div>
        </div>
        <button class="btn small" onClick=${() => copy(d.prefix)}><${Icon} name="mdi:content-copy" /> Copy prefix</button>
      </header>
      <${IconGrid} names=${d.icons} />
    </div>`;
}

function SearchView () {
  return html`
    <div class="searchview">
      ${searching.value ? html`<div class="loading"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`
        : app.state.query.trim() ? html`<${IconGrid} names=${results.value} />`
        : html`<div class="empty"><${Icon} name="mdi:magnify" /><p>Search across every Iconify set.</p></div>`}
    </div>`;
}

function FavoritesView () {
  const names = [...db.favs.value];
  return names.length
    ? html`<${IconGrid} names=${names} />`
    : html`<div class="empty"><${Icon} name="mdi:heart-outline" /><p>No favourites yet — tap the heart on any icon.</p></div>`;
}

function Content () {
  switch (app.state.route.name) {
    case 'sets':      return html`<${SetsView} />`;
    case 'set':       return html`<${SetView} />`;
    case 'search':    return html`<${SearchView} />`;
    case 'favorites': return html`<${FavoritesView} />`;
    default:          return html`<${Home} />`;
  }
}

// ── top bar ──────────────────────────────────────────────────────────────

function SizeControl () {
  return html`
    <div class="size">
      <${Icon} name="mdi:magnify-minus-outline" />
      <input type="range" min="56" max="200" step="1" value=${itemSize.value} onInput=${e => itemSize.value = +e.target.value} />
      <${Icon} name="mdi:magnify-plus-outline" />
    </div>`;
}

function TopBar () {
  const r = app.state.route;
  const grid = r.name === 'set' || r.name === 'search' || r.name === 'favorites';
  return html`
    <header class="topbar">
      <button class="ibtn nav-toggle" aria-label="Menu" onClick=${() => app.state.nav = true}><${Icon} name="mdi:menu" /></button>
      ${r.name === 'set' && html`<${IconButton} icon="arrow-left" label="Back" onClick=${() => app.go('sets')} />`}

      ${r.name === 'search'
        ? html`<div class="searchbox big">
            <${Icon} name="mdi:magnify" />
            <input type="search" placeholder="Search all of Iconify…" autofocus value=${app.state.query} onInput=${e => onSearch(e.target.value)} />
          </div>`
        : r.name === 'sets'
        ? html`<div class="searchbox">
            <${Icon} name="mdi:magnify" />
            <input type="search" placeholder="Filter sets…" value=${app.state.setFilter} onInput=${e => app.state.setFilter = e.target.value} />
          </div>`
        : html`<h1 class="topbar-title">${r.name === 'favorites' ? 'Favourites' : 'Icons'}</h1>`}

      <span class="spacer"></span>
      ${grid && html`<${SizeControl} />`}
      <${Settings} />
    </header>`;
}

// ── detail sheet ─────────────────────────────────────────────────────────

function Detail () {
  const name = app.state.detail;
  if (!name) return null;
  const [prefix, icon] = name.split(':');
  const fav = db.favs.value.has(name);
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) app.state.detail = null; }}>
      <div class="sheet" role="dialog" aria-modal="true">
        <button class="sheet-x" aria-label="Close" onClick=${() => app.state.detail = null}><${Icon} name="mdi:close" /></button>
        <div class="sheet-preview"><iconify-icon icon=${name}></iconify-icon></div>
        <div class="sheet-name">${icon}</div>
        <div class="sheet-set"><button class="linkish" onClick=${() => { app.state.detail = null; openSet(prefix); }}>${prefix}</button></div>
        <div class="sheet-actions">
          <button class="btn" onClick=${() => copy(name)}><${Icon} name="mdi:content-copy" /> Copy name</button>
          <button class="btn" onClick=${() => copySvg(name)}><${Icon} name="mdi:svg" /> Copy SVG</button>
          <button class="btn" onClick=${() => downloadSvg(name)}><${Icon} name="mdi:download" /> Download</button>
          <button class=${'btn' + (fav ? ' primary' : '')} onClick=${() => db.toggleFav(name)}>
            <${Icon} name=${fav ? 'mdi:heart' : 'mdi:heart-outline'} /> ${fav ? 'Favourited' : 'Favourite'}
          </button>
        </div>
      </div>
    </div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  useEffect(() => {
    db.loadFavs().catch(() => {});
    ensureCollections();   // warms the catalogue for home stats + sets
  }, []);

  return html`
    <>
      <${Sidebar} />
      ${app.state.nav && html`<div class="scrim-mobile" onClick=${() => app.state.nav = false}></div>`}
      <main id="app-main">
        <${TopBar} />
        <div class="content"><${Content} /></div>
      </main>
      <${Detail} />
    </>`;
}

// :::::: BOOT

app.init({ App });
