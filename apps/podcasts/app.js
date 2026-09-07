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

function fmtDuration (sec) {
  if (!sec || sec < 0) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate (ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const diff = (Date.now() - ms) / 86400000;
  if (diff < 1)  return 'today';
  if (diff < 2)  return 'yesterday';
  if (diff < 7)  return `${Math.floor(diff)} days ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// strip html from a feed description for a one-line teaser
function plain (htmlStr = '') {
  const el = document.createElement('div');
  el.innerHTML = htmlStr;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

// a feed description as readable paragraphs — block tags become breaks, then the
// text is taken via textContent, so nothing from the feed's markup is executed
function paragraphs (htmlStr = '') {
  const el = document.createElement('div');
  el.innerHTML = String(htmlStr)
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return (el.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n\n')
    .map(s => s.trim())
    .filter(Boolean);
}

// filter an episode list by the shared search query; `withPodcast` also matches
// on the podcast title, for the mixed "latest" stream
function filterEpisodes (list, withPodcast = false) {
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(ep =>
    ep.title.toLowerCase().includes(q) ||
    (withPodcast && podcastById.value[ep.podcastId]?.title.toLowerCase().includes(q)));
}

const sortEpisodes = (list, mode) => [...list].sort((a, b) =>
  mode === 'oldest' ? (a.pubDate || 0) - (b.pubDate || 0)
  : mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                    (b.pubDate || 0) - (a.pubDate || 0));

const sortPodcasts = (list, mode) => [...list].sort((a, b) =>
  mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                  (b.lastEpisodeAt || 0) - (a.lastEpisodeAt || 0));

const podcastById = computed(() => Object.fromEntries(db.podcasts.value.map(p => [p.id, p])));
const episodeById = computed(() => Object.fromEntries(db.episodes.value.map(e => [e.id, e])));

// :::::: SHARED BITS ::::::::::::::::::::::::::::::::::::::::

// artwork, served from the on-device thumbnail cache. while the small copy is
// being generated a placeholder shows; if it can't be made (image unreachable),
// it falls back to the original url for display; if that is broken too, the
// placeholder stays. the original is thus downloaded at most once and never
// shown at full size on the happy path.
function Art ({ src, size = 48, className = '' }) {
  // phase: 'pending' | 'ready' (thumb) | 'orig' (fallback to source) | 'none'
  const st = useSignal({ url: null, phase: src ? 'pending' : 'none', broken: false });

  useEffect(() => {
    if (!src) { st.value = { url: null, phase: 'none', broken: false }; return; }
    const cached = thumbs.peek(src);
    if (cached) { st.value = { url: cached, phase: 'ready', broken: false }; return; }

    st.value = { url: null, phase: 'pending', broken: false };
    let alive = true;
    thumbs.request(src).then(u => {
      if (!alive) return;
      st.value = u ? { url: u,   phase: 'ready', broken: false }
                   : { url: src, phase: 'orig',  broken: false };
    });
    return () => { alive = false; };
  }, [src]);

  const s = st.value;
  const showImg = (s.phase === 'ready' || s.phase === 'orig') && !s.broken;

  return showImg
    ? html`<img class=${'art ' + className} src=${s.url} alt="" loading="lazy"
                width=${size} height=${size}
                onError=${() => { st.value = { ...st.value, broken: true }; }} />`
    : html`<span class=${'art art-fallback ' + className} style=${`width:${size}px;height:${size}px`}>
             <${Icon} name="mdi:podcast" />
           </span>`;
}




// the play/pause control for one episode, reflecting the live player state
function PlayToggle ({ episode, size = 20 }) {
  const isCurrent = player.current.value?.id === episode.id;
  const isPlaying = isCurrent && player.playing.value;
  const icon = isCurrent && player.waiting.value ? 'svg-spinners:bars-scale-middle'
             : isPlaying ? 'mdi:pause' : 'mdi:play';
  return html`
    <button class=${'play-toggle' + (isCurrent ? ' current' : '')}
            title=${isPlaying ? 'Pause' : 'Play'} aria-label=${isPlaying ? 'Pause' : 'Play'}
            onClick=${() => player.play(episode)}>
      <${Icon} name=${icon} />
    </button>`;
}

function EpisodeRow ({ episode, showPodcast = false }) {
  const st      = db.stateOf(episode.id);
  const podcast = podcastById.value[episode.podcastId];
  const teaser  = plain(episode.description).slice(0, 200);

  return html`
    <div class=${'ep' + (st.done ? ' done' : '') + (player.current.value?.id === episode.id ? ' playing' : '')}>
      <button class="ep-art" onClick=${() => go('episode', episode.id)} aria-label="Open episode">
        <${Art} src=${episode.image || podcast?.image} size=${48} />
      </button>
      <div class="ep-body">
        <div class="ep-meta">
          ${showPodcast && podcast && html`
            <button class="ep-podcast" onClick=${() => go('podcast', podcast.id)}>${podcast.title}</button>`}
          <span class="ep-date">${fmtDate(episode.pubDate)}</span>
          ${episode.duration && html`<span class="ep-dur">· ${fmtDuration(episode.duration)}</span>`}
        </div>
        <button class="ep-title" onClick=${() => go('episode', episode.id)}>${episode.title}</button>
        ${teaser && html`<div class="ep-teaser">${teaser}</div>`}
        <${ProgressBar} state=${st} />
      </div>
      <div class="ep-actions">
        <${PlayToggle} episode=${episode} />
        <${IconButton} icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
                    label=${st.saved ? 'Remove from list' : 'Save for later'}
                    active=${st.saved} onClick=${() => db.toggleSaved(episode.id)} />
        <${IconButton} icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                    label=${st.done ? 'Mark unplayed' : 'Mark as done'}
                    active=${st.done} onClick=${() => db.toggleDone(episode.id)} />
        ${episode.link && html`
          <a class="ibtn" href=${episode.link} target="_blank" rel="noopener" title="Open episode page">
            <${Icon} name="mdi:open-in-new" />
          </a>`}
      </div>
    </div>`;
}

function SortPicker ({ value, options, onChange }) {
  return html`
    <div class="seg">
      ${options.map(([val, label]) => html`
        <button key=${val} class=${'seg-btn' + (value === val ? ' active' : '')}
                onClick=${() => onChange(val)}>${label}</button>`)}
    </div>`;
}

// a filter bar docked at the bottom of the scroll area — writes the shared
// `search` signal that the episode views filter on
function SearchBar ({ placeholder }) {
  return html`
    <div class="search-dock">
      <div class="search-bar">
        <${Icon} name="mdi:magnify" />
        <input type="search" placeholder=${placeholder} value=${search.value}
               onInput=${e => search.value = e.target.value} />
        ${search.value && html`
          <button class="ibtn" aria-label="Clear filter" onClick=${() => search.value = ''}>
            <${Icon} name="mdi:close" />
          </button>`}
      </div>
    </div>`;
}

// :::::: VIEWS :::::::::::::::::::::::::::::::::::::::::::::

const // :::::: COMPONENTS ::::::::::::::::::::::::::
PlayerBar   = await app.component('PlayerBar'),
ProgressBar = await app.component('ProgressBar'),
Sidebar     = await app.component('Sidebar'),

const // :::::: VIEWS :::::::::::::::::::::::::::::::
EpisodeDetailView   = await app.view('LatestView'),
LatestView          = await app.view('LatestView'),
EpisodePodcastView  = await app.view('LatestView'),
PodcastsView        = await app.view('PodcastsView'),
SavedView           = await app.view('SavedView'),
SettingsView        = await app.view('SettingsView');


function PodcastCard ({ podcast }) {
  const eps  = db.episodesByPodcast.value[podcast.id] ?? [];
  return html`
    <button class="pc-card" onClick=${() => go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} size=${160} className="pc-art" />
      <div class="pc-title">${podcast.title}</div>
      <div class="pc-sub">${eps.length} episode${eps.length === 1 ? '' : 's'} · ${fmtDate(podcast.lastEpisodeAt)}</div>
    </button>`;
}

function PodcastListRow ({ podcast }) {
  const eps = db.episodesByPodcast.value[podcast.id] ?? [];
  return html`
    <button class="pc-row" onClick=${() => go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} size=${56} />
      <div class="pc-row-body">
        <div class="pc-title">${podcast.title}</div>
        <div class="pc-sub">${podcast.author ? podcast.author + ' · ' : ''}${eps.length} episode${eps.length === 1 ? '' : 's'}</div>
      </div>
      <div class="pc-row-date">${fmtDate(podcast.lastEpisodeAt)}</div>
    </button>`;
}

// :::::: PLAYER BAR :::::::::::::::::::::::::::::::::::::::::


// :::::: DIALOGS :::::::::::::::::::::::::::::::::::::::::::

function AddDialog () {
  const value = useSignal('');
  const state = useSignal({ loading: false, error: '' });
  const ref   = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = async () => {
    const url = value.value.trim();
    if (!url) return;
    state.value = { loading: true, error: '' };
    try {
      const p = await db.subscribe(url, proxy.value);
      flash(`Subscribed to ${p.title}`);
      dialog.value = null;
      go('podcast', p.id);
    } catch (err) {
      state.value = { loading: false, error: err.message };
    }
  };

  return html`
    <${Scrim}>
      <div class="modal">
        <h2>Add a podcast</h2>
        <p class="modal-sub">Paste the podcast's RSS feed URL.</p>
        <input ref=${ref} class="modal-input" type="url" placeholder="https://example.com/feed.xml"
               value=${value.value}
               onInput=${e => value.value = e.target.value}
               onKeyDown=${e => { if (e.key === 'Enter') submit(); }} />
        ${state.value.error && html`<p class="modal-err">${state.value.error}</p>`}
        <div class="modal-actions">
          <button class="btn ghost" onClick=${() => dialog.value = null}>Cancel</button>
          <button class="btn primary" disabled=${state.value.loading} onClick=${submit}>
            ${state.value.loading ? html`<${Icon} name="svg-spinners:bars-scale-middle" /> Fetching…` : 'Subscribe'}
          </button>
        </div>
      </div>
    <//>`;
}




function Scrim ({ children }) {
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      ${children}
    </div>`;
}

// :::::: SIDEBAR :::::::::::::::::::::::::::::::::::::::::::

function NavItem ({ icon, label, name, count }) {
  const active = route.value.name === name || (name === 'podcasts' && route.value.name === 'podcast');
  return html`
    <button class=${'nav-item' + (active ? ' active' : '')} onClick=${() => go(name)}>
      <${Icon} name=${icon} /> <span>${label}</span>
      ${count != null && count > 0 && html`<span class="nav-count">${count}</span>`}
    </button>`;
}



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
