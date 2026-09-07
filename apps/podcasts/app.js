// apps/podcasts/app.js

// :::::: IMPORTS

// ::: vendors
import aufbau, { html, preact, effect } from '@aufbau/kits/preact-htm';
//const { signal } = aufbau;
const { computed, signal, useEffect, useRef, useSignal, Fragment } = preact;

// ::: shared
import { zugriff } from '/.shared/js/runtime.js';
const app = zugriff.app('podcasts');
import { Icon, IconButton, Button, Empty, AppSettings } from '/.shared/js/components/index.js';
import { stored }               from '/.shared/js/app/signals.js';
import { createThumbCache }     from '/.shared/js/thumbs.js';

// ::: local
import * as db           from './db.js';
import * as player       from './player.js';
import { DEFAULT_PROXY } from './feed.js';

const DEFAULT_IMG_RESIZER = 'https://img.pulgasari.dev/?url={url}&w={w}';

// :::::: SETTINGS (persisted signals) ::::::::::::::::::::::

const view        = stored('grid',   'podcasts:view');           // grid | list
const podcastSort = stored('recent', 'podcasts:podcast-sort');   // recent | alpha
const episodeSort = stored('newest', 'podcasts:episode-sort');   // newest | oldest | alpha
const proxy       = stored(DEFAULT_PROXY, 'podcasts:proxy');
const menuPos     = stored('bottom', 'podcasts:menu-pos');       // top | bottom | left | right
const playerPos   = stored('bottom', 'podcasts:player-pos');     // top | bottom
const imgResizer  = stored(DEFAULT_IMG_RESIZER, 'podcasts:img-resizer');

function buildResizer (url, w) {
  const tpl = imgResizer.value.trim();
  if (!tpl || !url) return null;
  return tpl.replaceAll('{url}', encodeURIComponent(url)).replaceAll('{w}', String(w));
}
const thumbs = createThumbCache({ resizer: buildResizer });

// the frame reads menu/player placement off #app's data-attributes; keep them
// in sync so the layout responds without an extra wrapper element
effect(() => {
  const el = document.getElementById('app');
  if (!el) return;
  el.dataset.menu   = menuPos.value;
  el.dataset.player = playerPos.value;
});

// :::::: UI STATE ::::::::::::::::::::::::::::::::::::::::::

const route    = signal({ name: 'latest' });   // { name, id? }
const search   = signal('');                   // the episode filter, per view
const dialog   = signal(null);                 // 'add' | 'settings' | null
const busy     = signal('');                   // a label while a long task runs

const flash = (text, kind = 'ok') =>
  kind === 'err' ? zugriff.toast.error(text) : zugriff.toast.success(text);

// navigating always clears the current filter
const go = (name, id) => { route.value = { name, id }; search.value = ''; };

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const podcastById = computed(() => Object.fromEntries(db.podcasts.value.map(p => [p.id, p])));
const episodeById = computed(() => Object.fromEntries(db.episodes.value.map(e => [e.id, e])));

// :::::: VIEWS :::::::::::::::::::::::::::::::::::::::::::::

import { 
  fmtDate, fmtDuration, 
  plain, paragraphs,
  filterEpisodes, sortEpisodes, sortPodcasts,
} from './methods.js';

const // :::::: COMPONENTS ::::::::::::::::::::::::::
Artwork        = await app.component('Artwork'),
EpisodeRow     = await app.component('EpisodeRow'),
NavItem        = await app.component('NavItem'),
PlayToggle     = await app.component('PlayToggle'),
PodcastCard    = await app.component('PodcastCard'),
PodcastListRow = await app.component('PodcastListRow'),
ProgressBar    = await app.component('ProgressBar'),
Scrim          = await app.component('Scrim'),
SortPicker     = await app.component('SortPicker');

const // :::::: PANELS ::::::::::::::::::::::::::::::
AddPodcastPanel = await app.component('AddPodcastPanel'),
PlayerBar       = await app.component('PlayerBar'),
SearchPanel     = await app.panel('SearchPanel'),
Sidebar         = await app.component('Sidebar');

const // :::::: VIEWS :::::::::::::::::::::::::::::::
EpisodeDetailView   = await app.view('LatestView'),
LatestView          = await app.view('LatestView'),
EpisodePodcastView  = await app.view('LatestView'),
PodcastsView        = await app.view('PodcastsView'),
SavedView           = await app.view('SavedView'),
SettingsView        = await app.view('SettingsView');

// :::::: BUSY BAR :::::::::::::::::::::::::::::::::::::::::::

function Busy () {
  const b = busy.value;
  if (!b) return null;
  return html`
    <div class="toasts">
      <div class="toast busy"><${Icon} name="svg-spinners:bars-scale-middle" /> ${b}</div>
    </div>`;
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function refreshAll () {
  if (!db.podcasts.value.length) { dialog.value = 'add'; return; }
  busy.value = 'Refreshing…';
  try {
    const results = await db.refreshAll(proxy.value, (n, total) => busy.value = `Refreshing ${n}/${total}…`);
    const added  = results.reduce((sum, r) => sum + (r.added || 0), 0);
    const failed = results.filter(r => r.error).length;
    flash(added ? `${added} new episode${added === 1 ? '' : 's'}` + (failed ? `, ${failed} feed${failed === 1 ? '' : 's'} failed` : '')
                : failed ? `${failed} feed${failed === 1 ? '' : 's'} failed` : 'Everything up to date',
          failed ? 'err' : 'ok');
  } finally { busy.value = ''; }
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function Body () {
  if (!db.ready.value) return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;
  const r = route.value;
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
    db.load()
      .then(() => thumbs.prewarm(db.podcasts.value.map(p => p.image)))
      .catch(err => flash('Could not open the library: ' + err.message, 'err'));

    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape' && dialog.value) dialog.value = null;
      if (!player.current.value) return;
      if (e.key === ' ') { e.preventDefault(); player.toggle(); }
      if (e.key === 'ArrowLeft')  player.skip(-15);
      if (e.key === 'ArrowRight') player.skip(30);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return html`
    <${Fragment}>
      <div id="app-main">
        <${Sidebar} />
        <main class="main"><${Body} /></main>
      </div>
      <${PlayerBar} />
      ${dialog.value === 'add'      && html`<${AddDialog} />`}
      ${dialog.value === 'settings' && html`<${SettingsDialog} />`}
      <${Busy} />
    </${Fragment}>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it skips the tools Shell
app.init({ App });
