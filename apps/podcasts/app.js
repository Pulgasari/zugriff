// apps/podcasts/app.js
//
// a podcast client that runs entirely on the device. subscriptions, episodes
// and listening state live in IndexedDB via @bunker/db (see db.js); feeds are
// fetched and parsed in the browser (feed.js); one shared <audio> element plays
// them and writes the position back as it goes (player.js).
//
// like every app under /apps it draws its own chrome — there is no tools Shell.
// the layout is a fixed sidebar, a scrolling main column and a docked player.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef, useSignal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot }   from './../../shared/js/app.js';
import { Icon }   from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';
import * as db     from './db.js';
import * as player from './player.js';
import { DEFAULT_PROXY } from './feed.js';

// :::::: SETTINGS (persisted signals) ::::::::::::::::::::::

const view        = stored('grid',   'podcasts:view');           // grid | list
const podcastSort = stored('recent', 'podcasts:podcast-sort');   // recent | alpha
const episodeSort = stored('newest', 'podcasts:episode-sort');   // newest | oldest | alpha
const proxy       = stored(DEFAULT_PROXY, 'podcasts:proxy');

// :::::: UI STATE ::::::::::::::::::::::::::::::::::::::::::

const route    = signal({ name: 'latest' });   // { name, id? }
const dialog   = signal(null);                 // 'add' | 'settings' | null
const toast    = signal(null);                 // { text, kind }
const busy     = signal('');                   // a label while a long task runs

let toastTimer = null;
function flash (text, kind = 'ok') {
  toast.value = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.value = null, kind === 'err' ? 5000 : 3000);
}

const go = (name, id) => { route.value = { name, id }; };

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

const sortEpisodes = (list, mode) => [...list].sort((a, b) =>
  mode === 'oldest' ? (a.pubDate || 0) - (b.pubDate || 0)
  : mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                    (b.pubDate || 0) - (a.pubDate || 0));

const sortPodcasts = (list, mode) => [...list].sort((a, b) =>
  mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                  (b.lastEpisodeAt || 0) - (a.lastEpisodeAt || 0));

const podcastById = computed(() => Object.fromEntries(db.podcasts.value.map(p => [p.id, p])));

// :::::: SHARED BITS ::::::::::::::::::::::::::::::::::::::::

function Art ({ src, size = 48, className = '' }) {
  return src
    ? html`<img class=${'art ' + className} src=${src} alt="" loading="lazy" width=${size} height=${size} />`
    : html`<span class=${'art art-fallback ' + className} style=${`width:${size}px;height:${size}px`}>
             <${Icon} name="mdi:podcast" size=${Math.round(size * 0.5)} />
           </span>`;
}

function ProgressBar ({ state }) {
  if (!state || (!state.position && !state.done)) return null;
  const dur = state.duration || 0;
  const pct = state.done ? 100 : (dur ? Math.min(100, (state.position / dur) * 100) : 0);
  return html`<span class="ep-progress"><span class="ep-progress-fill" style=${`width:${pct}%`}></span></span>`;
}

function IconBtn ({ icon, label, onClick, active, disabled, size = 18, className = '' }) {
  return html`
    <button class=${'ibtn ' + className + (active ? ' active' : '')} title=${label} aria-label=${label}
            disabled=${disabled} onClick=${onClick}>
      <${Icon} name=${icon} size=${size} />
    </button>`;
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
      <${Icon} name=${icon} size=${size} />
    </button>`;
}

function EpisodeRow ({ episode, showPodcast = false }) {
  const st      = db.stateOf(episode.id);
  const podcast = podcastById.value[episode.podcastId];
  const teaser  = plain(episode.description).slice(0, 200);

  return html`
    <div class=${'ep' + (st.done ? ' done' : '') + (player.current.value?.id === episode.id ? ' playing' : '')}>
      <${Art} src=${episode.image || podcast?.image} size=${48} />
      <div class="ep-body">
        <div class="ep-meta">
          ${showPodcast && podcast && html`
            <button class="ep-podcast" onClick=${() => go('podcast', podcast.id)}>${podcast.title}</button>`}
          <span class="ep-date">${fmtDate(episode.pubDate)}</span>
          ${episode.duration && html`<span class="ep-dur">· ${fmtDuration(episode.duration)}</span>`}
        </div>
        <div class="ep-title">${episode.title}</div>
        ${teaser && html`<div class="ep-teaser">${teaser}</div>`}
        <${ProgressBar} state=${st} />
      </div>
      <div class="ep-actions">
        <${PlayToggle} episode=${episode} />
        <${IconBtn} icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
                    label=${st.saved ? 'Remove from list' : 'Save for later'}
                    active=${st.saved} onClick=${() => db.toggleSaved(episode.id)} />
        <${IconBtn} icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                    label=${st.done ? 'Mark unplayed' : 'Mark as done'}
                    active=${st.done} onClick=${() => db.toggleDone(episode.id)} />
        ${episode.link && html`
          <a class="ibtn" href=${episode.link} target="_blank" rel="noopener" title="Open episode page">
            <${Icon} name="mdi:open-in-new" size=${16} />
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

function Empty ({ icon, title, hint, action }) {
  return html`
    <div class="empty">
      <${Icon} name=${icon} size=${56} />
      <p class="empty-title">${title}</p>
      ${hint && html`<p class="empty-hint">${hint}</p>`}
      ${action}
    </div>`;
}

// :::::: VIEWS :::::::::::::::::::::::::::::::::::::::::::::

function LatestView () {
  const recent = [...db.episodes.value]
    .sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
    .slice(0, 200);

  return html`
    <div class="view">
      <div class="view-head">
        <h1>Latest episodes</h1>
        <div class="view-tools">
          <${IconBtn} icon="mdi:refresh" label="Refresh all feeds" onClick=${refreshAll} disabled=${!!busy.value} />
        </div>
      </div>
      ${!db.podcasts.value.length
        ? html`<${Empty} icon="mdi:rss" title="No subscriptions yet"
                 hint="Add a podcast by its RSS feed URL to see its latest episodes here."
                 action=${html`<button class="btn primary" onClick=${() => dialog.value = 'add'}>
                   <${Icon} name="mdi:plus" size=${16} /> Add a podcast</button>`} />`
        : !recent.length
        ? html`<${Empty} icon="mdi:playlist-remove" title="No episodes found" hint="Try refreshing your feeds." />`
        : html`<div class="ep-list">${recent.map(ep => html`<${EpisodeRow} episode=${ep} showPodcast key=${ep.id} />`)}</div>`}
    </div>`;
}

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

function PodcastsView () {
  const list = sortPodcasts(db.podcasts.value, podcastSort.value);

  return html`
    <div class="view">
      <div class="view-head">
        <h1>Podcasts</h1>
        <div class="view-tools">
          <${SortPicker} value=${podcastSort.value} onChange=${v => podcastSort.value = v}
             options=${[['recent', 'Recently updated'], ['alpha', 'A–Z']]} />
          <div class="seg">
            <${IconBtn} icon="mdi:view-grid" label="Grid" active=${view.value === 'grid'} onClick=${() => view.value = 'grid'} />
            <${IconBtn} icon="mdi:view-list" label="List" active=${view.value === 'list'} onClick=${() => view.value = 'list'} />
          </div>
          <${IconBtn} icon="mdi:plus" label="Add podcast" onClick=${() => dialog.value = 'add'} />
        </div>
      </div>
      ${!list.length
        ? html`<${Empty} icon="mdi:rss" title="No subscriptions yet"
                 hint="Paste a podcast's RSS feed URL to subscribe."
                 action=${html`<button class="btn primary" onClick=${() => dialog.value = 'add'}>
                   <${Icon} name="mdi:plus" size=${16} /> Add a podcast</button>`} />`
        : html`
          <aufbau-index class="pc-index" viewmode=${view.value}
                        item-size="150px" gap=${view.value === 'grid' ? '1.25rem' : '0'}>
            ${list.map(p => html`
              <aufbau-item key=${p.id}>
                ${view.value === 'grid'
                  ? html`<${PodcastCard} podcast=${p} />`
                  : html`<${PodcastListRow} podcast=${p} />`}
              </aufbau-item>`)}
          </aufbau-index>`}
    </div>`;
}

function PodcastDetailView ({ id }) {
  const podcast = podcastById.value[id];
  if (!podcast) return html`<${Empty} icon="mdi:alert-outline" title="Podcast not found" />`;

  const eps = sortEpisodes(db.episodesByPodcast.value[id] ?? [], episodeSort.value);
  const doneCount = eps.filter(e => db.stateOf(e.id).done).length;

  const remove = async () => {
    if (!confirm(`Unsubscribe from “${podcast.title}”? This removes its episodes and their progress.`)) return;
    await db.unsubscribe(id);
    flash('Unsubscribed');
    go('podcasts');
  };

  const refreshOne = async () => {
    busy.value = 'Refreshing…';
    try {
      const { added } = await db.refresh(id, proxy.value);
      flash(added ? `${added} new episode${added === 1 ? '' : 's'}` : 'Up to date');
    } catch (err) { flash(err.message, 'err'); }
    finally { busy.value = ''; }
  };

  return html`
    <div class="view">
      <button class="back" onClick=${() => go('podcasts')}><${Icon} name="mdi:arrow-left" size=${16} /> Podcasts</button>

      <header class="pd-head">
        <${Art} src=${podcast.image} size=${140} className="pd-art" />
        <div class="pd-info">
          <h1>${podcast.title}</h1>
          ${podcast.author && html`<div class="pd-author">${podcast.author}</div>`}
          <div class="pd-stats">${eps.length} episodes · ${doneCount} done</div>
          ${podcast.description && html`<p class="pd-desc">${plain(podcast.description).slice(0, 400)}</p>`}
          <div class="pd-actions">
            <button class="btn" onClick=${refreshOne} disabled=${!!busy.value}>
              <${Icon} name="mdi:refresh" size=${16} /> Refresh</button>
            ${podcast.link && html`<a class="btn ghost" href=${podcast.link} target="_blank" rel="noopener">
              <${Icon} name="mdi:web" size=${16} /> Website</a>`}
            <button class="btn danger" onClick=${remove}>
              <${Icon} name="mdi:trash-can-outline" size=${16} /> Unsubscribe</button>
          </div>
        </div>
      </header>

      <div class="pd-tools">
        <span class="pd-tools-label">Episodes</span>
        <${SortPicker} value=${episodeSort.value} onChange=${v => episodeSort.value = v}
           options=${[['newest', 'Newest'], ['oldest', 'Oldest'], ['alpha', 'A–Z']]} />
      </div>

      <div class="ep-list">${eps.map(ep => html`<${EpisodeRow} episode=${ep} key=${ep.id} />`)}</div>
    </div>`;
}

function SavedView () {
  const list = db.savedEpisodes.value;
  return html`
    <div class="view">
      <div class="view-head"><h1>Listen later</h1></div>
      ${!list.length
        ? html`<${Empty} icon="mdi:bookmark-outline" title="Your list is empty"
                 hint="Tap the bookmark on any episode to keep it here." />`
        : html`<div class="ep-list">${list.map(ep => html`<${EpisodeRow} episode=${ep} showPodcast key=${ep.id} />`)}</div>`}
    </div>`;
}

// :::::: PLAYER BAR :::::::::::::::::::::::::::::::::::::::::

const RATES = [0.8, 1, 1.2, 1.5, 1.75, 2];

function PlayerBar () {
  const ep = player.current.value;
  if (!ep) return null;

  const podcast = podcastById.value[ep.podcastId];
  const dur  = player.duration.value || ep.duration || 0;
  const t    = player.time.value;

  const cycleRate = () => {
    const i = RATES.indexOf(player.rate.value);
    player.setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };

  return html`
    <footer class="player">
      <div class="pl-meta">
        <${Art} src=${ep.image || podcast?.image} size=${52} />
        <div class="pl-info">
          <div class="pl-title" title=${ep.title}>${ep.title}</div>
          <div class="pl-podcast">${podcast?.title || ''}</div>
        </div>
      </div>

      <div class="pl-controls">
        <${IconBtn} icon="mdi:rewind-15" label="Back 15s" size=${22} onClick=${() => player.skip(-15)} />
        <button class="pl-play" title=${player.playing.value ? 'Pause' : 'Play'} onClick=${player.toggle}>
          <${Icon} name=${player.waiting.value ? 'svg-spinners:bars-scale-middle' : player.playing.value ? 'mdi:pause' : 'mdi:play'} size=${26} />
        </button>
        <${IconBtn} icon="mdi:fast-forward-30" label="Forward 30s" size=${22} onClick=${() => player.skip(30)} />
      </div>

      <div class="pl-scrub">
        <span class="pl-time">${fmtDuration(t)}</span>
        <input class="pl-range" type="range" min="0" max=${Math.max(dur, 1)} step="1" value=${Math.min(t, dur || t)}
               onInput=${e => player.seek(Number(e.target.value))} />
        <span class="pl-time">${dur ? '-' + fmtDuration(dur - t) : ''}</span>
      </div>

      <div class="pl-right">
        <button class="rate" title="Playback speed" onClick=${cycleRate}>${player.rate.value}×</button>
        <${IconBtn} icon=${db.stateOf(ep.id).done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                    label="Mark as done" active=${db.stateOf(ep.id).done} onClick=${() => db.toggleDone(ep.id)} />
        <${IconBtn} icon="mdi:close" label="Close player" onClick=${() => { player.pause(); player.current.value = null; }} />
      </div>
    </footer>`;
}

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
            ${state.value.loading ? html`<${Icon} name="svg-spinners:bars-scale-middle" size=${16} /> Fetching…` : 'Subscribe'}
          </button>
        </div>
      </div>
    <//>`;
}

function SettingsDialog () {
  const proxyVal = useSignal(proxy.value);
  const fileRef  = useRef(null);

  const doExport = () => {
    const data = db.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `podcasts-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(`Exported ${data.feeds.length} subscription${data.feeds.length === 1 ? '' : 's'}`);
  };

  const doImport = async file => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { flash('Could not read that file', 'err'); return; }
    dialog.value = null;
    busy.value = 'Importing…';
    try {
      const results = await db.importData(data, proxy.value, (n, total) => busy.value = `Importing ${n}/${total}…`);
      const added = results.filter(r => r.added).length;
      const failed = results.filter(r => r.error).length;
      flash(`Imported ${added} new` + (failed ? `, ${failed} failed` : ''), failed ? 'err' : 'ok');
    } catch (err) { flash(err.message, 'err'); }
    finally { busy.value = ''; }
  };

  return html`
    <${Scrim}>
      <div class="modal wide">
        <h2>Settings</h2>

        <label class="field">
          <span class="field-label">CORS proxy</span>
          <span class="field-hint">Most podcast feeds block direct browser requests. Feeds are fetched directly first, then through this proxy. <code>{url}</code> is replaced with the feed URL. Clear it to use direct requests only.</span>
          <input class="modal-input" type="text" value=${proxyVal.value}
                 placeholder=${DEFAULT_PROXY}
                 onInput=${e => proxyVal.value = e.target.value} />
          <span class="field-row">
            <button class="btn ghost small" onClick=${() => proxyVal.value = DEFAULT_PROXY}>Reset to default</button>
            <button class="btn ghost small" onClick=${() => proxyVal.value = ''}>Direct only</button>
          </span>
        </label>

        <div class="field">
          <span class="field-label">Subscriptions</span>
          <span class="field-hint">Back up your subscriptions and listening progress as JSON, or restore from a file.</span>
          <span class="field-row">
            <button class="btn" onClick=${doExport}><${Icon} name="mdi:download" size=${16} /> Export JSON</button>
            <button class="btn" onClick=${() => fileRef.current?.click()}><${Icon} name="mdi:upload" size=${16} /> Import JSON</button>
            <input ref=${fileRef} type="file" accept="application/json,.json" hidden
                   onChange=${e => { doImport(e.target.files[0]); e.target.value = ''; }} />
          </span>
        </div>

        <div class="modal-actions">
          <button class="btn primary" onClick=${() => { proxy.value = proxyVal.value.trim(); dialog.value = null; flash('Settings saved'); }}>Done</button>
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
      <${Icon} name=${icon} size=${20} /> <span>${label}</span>
      ${count != null && count > 0 && html`<span class="nav-count">${count}</span>`}
    </button>`;
}

function Sidebar () {
  const saved = db.savedEpisodes.value.length;
  return html`
    <aside class="sidebar">
      <div class="brand"><${Icon} name="mdi:podcast" size=${24} /> <span>Podcasts</span></div>

      <button class="btn primary add" onClick=${() => dialog.value = 'add'}>
        <${Icon} name="mdi:plus" size=${16} /> Add podcast</button>

      <nav class="nav">
        <${NavItem} icon="mdi:playlist-play"   label="Latest"    name="latest" />
        <${NavItem} icon="mdi:view-grid-outline" label="Podcasts" name="podcasts" count=${db.podcasts.value.length} />
        <${NavItem} icon="mdi:bookmark-outline" label="Listen later" name="saved" count=${saved} />
      </nav>

      <div class="side-foot">
        <button class="nav-item" onClick=${() => dialog.value = 'settings'}>
          <${Icon} name="mdi:cog-outline" size=${18} /> <span>Settings</span></button>
        <div class="side-links">
          <a href="./../"><${Icon} name="mdi:view-grid-outline" size=${14} /> apps</a>
          <a href="./../../"><${Icon} name="mdi:home-outline" size=${14} /> launcher</a>
        </div>
      </div>
    </aside>`;
}

// :::::: TOAST :::::::::::::::::::::::::::::::::::::::::::::

function Toast () {
  const t = toast.value;
  const b = busy.value;
  if (!t && !b) return null;
  return html`
    <div class="toasts">
      ${b && html`<div class="toast busy"><${Icon} name="svg-spinners:bars-scale-middle" size=${16} /> ${b}</div>`}
      ${t && html`<div class=${'toast ' + t.kind}>${t.text}</div>`}
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
  if (!db.ready.value) return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" size=${28} /></div>`;
  const r = route.value;
  switch (r.name) {
    case 'podcasts': return html`<${PodcastsView} />`;
    case 'podcast':  return html`<${PodcastDetailView} id=${r.id} />`;
    case 'saved':    return html`<${SavedView} />`;
    default:         return html`<${LatestView} />`;
  }
}

function App () {
  useEffect(() => {
    db.load().catch(err => flash('Could not open the library: ' + err.message, 'err'));

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
    <div class="pc-app">
      <${Sidebar} />
      <main class="main"><${Body} /></main>
      <${PlayerBar} />
      ${dialog.value === 'add'      && html`<${AddDialog} />`}
      ${dialog.value === 'settings' && html`<${SettingsDialog} />`}
      <${Toast} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it skips the tools Shell
boot({ config, App, shell: false });
