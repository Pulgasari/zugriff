// apps/podcasts/app.js

/*
1. unnötige ellenlange kommentare entfernt
2. `app.flash` entfernt -> sinnloser wrapper um app.toast
   (und diese bekloppte "err/ok" muster aus go, rust und co führ ich erst recht nich ein)   
*/

// ::: vendors
import { useEffect } from 'preact/hooks';
import { typedSignal, oneOf, text, local } from '@aufbau/signals';

// ::: shared
import { createThumbCache } from '/.shared/js/thumbs.js';

// ::: app modules
import * as db           from './modules/db.js';
import player            from './modules/player.js';
import { DEFAULT_PROXY } from './modules/feed.js';

// ::: the app handle
const app = zugriff.app;
app.db     = db;
app.player = player;

// :::::: META :::::::::::::::::::::::::::::::::::::::::::::::::

const DEFAULT_IMG_RESIZER = 'https://img.pulgasari.dev/?url={url}&w={w}';

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::::

app.state.route  = { name: 'latest', id: null }; // { name, id }
app.state.search = '';   // shared episode filter
app.state.dialog = null; // 'add' | 'settings' | null
app.state.busy   = '';   // a label while a long task runs

app.settings = typedSignal({
  podcastSort : oneOf(['recent', 'alpha'], 'recent'),
  episodeSort : oneOf(['newest', 'oldest', 'alpha'], 'newest'),
  view        : oneOf(['grid', 'list'], 'grid'),
  menuPos     : oneOf(['top', 'bottom', 'left', 'right'], 'bottom'),
  playerPos   : oneOf(['top', 'bottom'], 'bottom'),
  proxy       : text(DEFAULT_PROXY),
  imgResizer  : text(DEFAULT_IMG_RESIZER),
}, { key: 'zugriff:podcasts:settings', store: local });

// on-device artwork thumbnail cache, resized through the configured endpoint
const buildResizer = (url, w) => {
  const tpl = app.settings.imgResizer.trim();
  if (!tpl || !url) return null;
  return tpl.replaceAll('{url}', encodeURIComponent(url)).replaceAll('{w}', String(w));
};
app.thumbs = createThumbCache({ resizer: buildResizer });

// ::: navigation + toast — navigating always clears the current filter
app.go    = (name, id)          => { app.state.route = { name, id: id ?? null }; app.state.search = ''; };
app.flash = (text, kind = 'ok') => kind === 'err' ? app.toast.error(text) : app.toast.success(text);

// :::::: ACTIONS

async function refreshAll () {
  if (!app.db.podcasts.value.length) { app.state.dialog = 'add'; return; }
  app.state.busy = 'Refreshing…';
  try {
    const results = await app.db.refreshAll(app.settings.proxy, (n, total) => app.state.busy = `Refreshing ${n}/${total}…`);
    const added   = results.reduce((sum, r) => sum + (r.added || 0), 0);
    const failed  = results.filter(r => r.error).length;
    const message = `${added} new episode(s)` + `, ${failed} feed(s) failed` + 'Everything up to date';
    app.toast(message);
  } finally { app.state.busy = ''; }
}

app.actions = {
  'close-dialog'  : () => app.state.dialog = null,
  
  'refresh-all'   : refreshAll,
  'add-podcast'   : () => app.state.dialog = 'add',
  'open-settings' : () => app.state.dialog = 'settings',
  
  'toggle-play'   : () => app.player.toggle(),
  'skip-back'     : () => app.player.skip(-15),
  'skip-forward'  : () => app.player.skip(30),
};

// :::::: HOTKEYS

const hasPlayer = () => !!app.player.episode;
app.hotKeys = {
  'ctrl + s'    : { action: 'toggle-settings' },
  
  'space'       : { action: 'toggle-play', when: hasPlayer },
  'arrow-left'  : { action: 'skip-back',   when: hasPlayer },
  'arrow-right' : { action: 'skip-back',   when: hasPlayer },
};

// :::::: EFFECTS ::::::::::::::::::::::::::::::::::::::::::::
// the frame reads menu/player placement off #app's data-attributes; keep them in sync
// so the layout responds without an extra wrapper element

app.effect(() => {
  const el = document.getElementById('app'); if (!el) return;
  el.dataset.menu   = app.settings.menuPos;
  el.dataset.player = app.settings.playerPos;
});

// :::::: UI ::::::::::::::::::::::::::::::::::::::::::::::::::

const // shared components
Icon = await zugriff.component('Icon');

const // views
LatestView         = await app.view('LatestView'),
PodcastsView       = await app.view('PodcastsView'),
PodcastDetailView  = await app.view('PodcastDetailView'),
EpisodeDetailView  = await app.view('EpisodeDetailView'),
SavedView          = await app.view('SavedVi,ew');

const // panels
SidebarPanel    = await app.panel('SidebarPanel'),
PlayerPanel     = await app.panel('PlayerPanel'),
AddPodcastPanel = await app.panel('AddPodcastPanel'),
SettingsPanel   = await app.panel('SettingsPanel');

// :::::: FRAME ::::::::::::::::::::::::::::::::::::::::::::::

function Busy () {
  const b = app.state.busy;
  if (!b) return null;
  return html`
    <div class="toasts">
      <div class="toast busy"><${Icon} name="svg-spinners:bars-scale-middle" /> ${b}</div>
    </div>`;
}

function Body () {
  const r = app.state.route;
  switch (r.name) {
    case 'podcasts': return html`<${PodcastsView} />`;
    case 'podcast':  return html`<${PodcastDetailView} id=${r.id} />`;
    case 'episode':  return html`<${EpisodeDetailView} id=${r.id} />`;
    case 'saved':    return html`<${SavedView} />`;
    default:         return html`<${LatestView} />`;
  }
}

function App () {
  useEffect(() => {
    app.db.load()
      .then(() => app.thumbs.prewarm(app.db.podcasts.value.map(p => p.image)))
      .catch(err => app.flash('Could not open the library: ' + err.message, 'err'));
  }, []);

  if (!app.db.ready.value) return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;

  const dialog = app.state.dialog;
  return html`<>
      <div id="app-main">
        <${SidebarPanel} />
        <main><${Body} /></main>
      </div>
      <${PlayerPanel} />
      ${dialog === 'add'      && html`<${AddPodcastPanel} />`}
      ${dialog === 'settings' && html`<${SettingsPanel} />`}
      <${Busy} />
    </>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it owns the whole #app root
app.init({ App });
