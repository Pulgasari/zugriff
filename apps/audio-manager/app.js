// apps/audio-manager/app.js

// :::::: IMPORTS

// ::: vendors
import { html, Fragment, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { zugriff } from '/.shared/js/runtime.js';
const app = zugriff.app('audio-manager');
import { Icon, IconButton, InstallTip, AppSettings } from '/.shared/js/components/index.js';
import * as fs                           from '/.shared/js/filesystem/fsaccess.js';

// ::: local
import * as db     from './db.js';
import * as player from './player.js';
//import { displayTitle, displayArtist, displayAlbum } from './db.js';
const { displayTitle, displayArtist, displayAlbum } = db;

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::

const route   = signal({ name: 'songs' });   // songs | albums | artists | album | artist
const search  = signal('');
const sort    = signal({ key: 'artist', dir: 1 });
const navOpen = signal(false);

const flash = (text, kind = 'ok') =>
  kind === 'err' ? zugriff.toast.error(text) : zugriff.toast.success(text);
const go = (name, id) => { route.value = { name, id }; navOpen.value = false; };

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

function fmtTime (sec) {
  if (!sec || sec < 0 || !Number.isFinite(sec)) return '0:00';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTotal (sec) {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const cmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

// ── cover urls (session cache, revoked on unmount) ──────────────────────────
const coverUrls = new Map();
function coverUrl (blob) {
  if (!blob) return null;
  let u = coverUrls.get(blob);
  if (!u) coverUrls.set(blob, u = URL.createObjectURL(blob));
  return u;
}
function dropCovers () { for (const u of coverUrls.values()) URL.revokeObjectURL(u); coverUrls.clear(); }

// ── derived lists ───────────────────────────────────────────────────────────
const matches = (t, q) =>
  displayTitle(t).toLowerCase().includes(q) || displayArtist(t).toLowerCase().includes(q) || displayAlbum(t).toLowerCase().includes(q);

const filteredTracks = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q ? db.tracks.value.filter(t => matches(t, q)) : db.tracks.value;
});

const sortedTracks = computed(() => {
  const { key, dir } = sort.value;
  const val = t => key === 'title'  ? displayTitle(t)
                 : key === 'album'  ? displayAlbum(t)
                 : key === 'duration' ? (t.duration ?? 0)
                 : displayArtist(t);
  return [...filteredTracks.value].sort((a, b) => {
    const av = val(a), bv = val(b);
    const base = key === 'duration' ? av - bv : cmp(av, bv);
    // stable-ish secondary ordering inside an artist/album
    return (base || cmp(displayAlbum(a), displayAlbum(b)) || (a.trackNo ?? 1e9) - (b.trackNo ?? 1e9)) * dir;
  });
});

const filteredAlbums = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q ? db.albums.value.filter(a => a.album.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)) : db.albums.value;
});
const filteredArtists = computed(() => {
  const q = search.value.trim().toLowerCase();
  return q ? db.artists.value.filter(a => a.name.toLowerCase().includes(q)) : db.artists.value;
});

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function addFolder () {
  if (!fs.supported()) { flash('This browser can’t open folders — try a Chromium browser.', 'err'); return; }
  try { const rec = await db.addFolder(); if (rec) flash(`Added ${rec.name}`); }
  catch (err) { flash(err.message, 'err'); }
}
async function removeFolder (s) {
  if (!confirm(`Remove “${s.name}”? Your files stay untouched — this only forgets the folder.`)) return;
  await db.removeFolder(s.id);
}
const setSort = key => sort.value = sort.value.key === key ? { key, dir: -sort.value.dir } : { key, dir: 1 };

// :::::: SHARED BITS :::::::::::::::::::::::::::::::::::::::

function Cover ({ blob, size = 40, radius = 6 }) {
  const u = coverUrl(blob);
  const style = `width:${size}px;height:${size}px;border-radius:${radius}px`;
  return u
    ? html`<img class="cover" style=${style} src=${u} alt="" loading="lazy" />`
    : html`<span class="cover ph" style=${style}><${Icon} name="mdi:music-note" /></span>`;
}

function PlayGlyph ({ track }) {
  const isCur = player.current.value?.key === track.key;
  return html`<${Icon} name=${isCur && player.playing.value ? 'mdi:volume-high' : 'mdi:play'} />`;
}

// :::::: SIDEBAR :::::::::::::::::::::::::::::::::::::::::::

function NavItem ({ name, icon, label }) {
  const active = route.value.name === name;
  return html`
    <button class=${'nav-item' + (active ? ' active' : '')} onClick=${() => go(name)}>
      <${Icon} name=${icon} /> <span>${label}</span>
    </button>`;
}

function SourceRow ({ source }) {
  const state = db.perms.value[source.id];
  const busy  = db.scanning.value[source.id];
  const reconnect = () => db.reconnect(source.id).then(r => { if (!r.granted) db.repick(source.id).then(ok => ok || flash('Could not open that folder', 'err')); });
  return html`
    <div class="src">
      <button class="src-open" onClick=${reconnect} title=${source.name}>
        <${Icon} name=${state === 'granted' ? 'mdi:folder-music-outline' : 'mdi:folder-alert-outline'} />
        <span class="src-name">${source.name}</span>
        ${busy && html`<${Icon} name="svg-spinners:bars-scale-middle" />`}
      </button>
      <button class="src-x" title="Remove folder" onClick=${() => removeFolder(source)}><${Icon} name="mdi:close" /></button>
    </div>`;
}

function Sidebar () {
  const needAuth = db.sources.value.some(s => db.perms.value[s.id] !== 'granted');
  return html`
    <aside class=${'sidebar' + (navOpen.value ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="mdi:music-box-multiple-outline" /> <span>Music</span>
        <button class="ibtn nav-close" aria-label="Close" onClick=${() => navOpen.value = false}><${Icon} name="mdi:close" /></button>
      </div>

      <nav class="nav-group">
        <${NavItem} name="songs"   icon="mdi:playlist-music-outline" label="Songs" />
        <${NavItem} name="albums"  icon="mdi:album"                  label="Albums" />
        <${NavItem} name="artists" icon="mdi:account-music-outline"  label="Artists" />
      </nav>

      <div class="src-head">Folders</div>
      <div class="srcs">
        ${db.sources.value.length
          ? db.sources.value.map(s => html`<${SourceRow} key=${s.id} source=${s} />`)
          : html`<p class="src-hint">No folders yet.</p>`}
      </div>
      ${needAuth && html`<p class="src-hint warn">Some folders need permission — click one to reconnect.</p>`}

      <div class="side-foot">
        <${InstallTip} show=${db.sources.value.length > 0}
                       message="Install the app so your folders stay connected between visits." />
        <button class="btn primary" onClick=${addFolder}><${Icon} name="mdi:folder-plus-outline" /> Add folder</button>
        <div class="side-links">
          <a href="./../"><${Icon} name="mdi:view-grid-outline" /> apps</a>
          <a href="./../../"><${Icon} name="mdi:home-outline" /> launcher</a>
        </div>
      </div>
    </aside>`;
}


// :::::: VIEWS ::::::::::::::::::::::::::::::::::::::::::::::

function SongsTable () {
  const rows = sortedTracks.value;
  if (!rows.length) return html`<${Empty} q=${search.value} />`;
  const head = (key, label, cls = '') => html`
    <button class=${'th ' + cls + (sort.value.key === key ? ' on' : '')} onClick=${() => setSort(key)}>
      ${label}${sort.value.key === key ? html` <${Icon} name=${sort.value.dir > 0 ? 'mdi:menu-up' : 'mdi:menu-down'} size=${14} />` : ''}
    </button>`;
  return html`
    <div class="songs">
      <div class="song-head">
        <span></span>${head('title', 'Title', 'c-title')}${head('artist', 'Artist', 'c-artist')}${head('album', 'Album', 'c-album')}${head('duration', 'Time', 'c-time')}
      </div>
      ${rows.map(t => {
        const cur = player.current.value?.key === t.key;
        return html`
          <div class=${'song' + (cur ? ' active' : '')} key=${t.key} onDblClick=${() => player.play(t, rows)}>
            <button class="song-play" onClick=${() => player.play(t, rows)}><${PlayGlyph} track=${t} /></button>
            <span class="c-title" title=${displayTitle(t)}>${displayTitle(t)}</span>
            <span class="c-artist" title=${displayArtist(t)}>${displayArtist(t)}</span>
            <span class="c-album" title=${displayAlbum(t)}>${displayAlbum(t)}</span>
            <span class="c-time">${fmtTime(t.duration)}</span>
          </div>`;
      })}
    </div>`;
}

function AlbumsGrid () {
  const rows = filteredAlbums.value;
  if (!rows.length) return html`<${Empty} q=${search.value} />`;
  return html`
    <aufbau-index class="albums" viewmode="grid" item-size="160px" gap="1.1rem">
      ${rows.map(a => html`
        <button class="album-card" key=${a.key} onClick=${() => go('album', a.key)}>
          <div class="album-art">
            <${Cover} blob=${a.cover} size=${160} radius=${10} />
            <span class="album-play" onClick=${e => { e.stopPropagation(); player.play(a.tracks[0], a.tracks); }}><${Icon} name="mdi:play" /></span>
          </div>
          <div class="album-name" title=${a.album}>${a.album}</div>
          <div class="album-artist" title=${a.artist}>${a.artist}</div>
        </button>`)}
    </aufbau-index>`;
}

function AlbumDetail ({ id }) {
  const a = db.albums.value.find(x => x.key === id);
  if (!a) return html`<${Empty} q="" />`;
  const total = a.tracks.reduce((n, t) => n + (t.duration || 0), 0);
  return html`
    <div class="detail">
      <header class="detail-head">
        <${Cover} blob=${a.cover} size=${180} radius=${12} />
        <div class="detail-meta">
          <div class="detail-kind">Album</div>
          <h1>${a.album}</h1>
          <div class="detail-sub">${a.artist}${a.year ? ` · ${a.year}` : ''} · ${a.tracks.length} songs${total ? ` · ${fmtTotal(total)}` : ''}</div>
          <button class="btn primary" onClick=${() => player.play(a.tracks[0], a.tracks)}><${Icon} name="mdi:play" /> Play</button>
        </div>
      </header>
      <${TrackList} tracks=${a.tracks} numbered />
    </div>`;
}

function ArtistsList () {
  const rows = filteredArtists.value;
  if (!rows.length) return html`<${Empty} q=${search.value} />`;
  return html`
    <div class="artists">
      ${rows.map(a => html`
        <button class="artist-row" key=${a.name} onClick=${() => go('artist', a.name)}>
          <${Cover} blob=${a.cover} size=${48} radius=${999} />
          <div class="artist-meta">
            <div class="artist-name">${a.name}</div>
            <div class="artist-sub">${a.albums.size} album${a.albums.size === 1 ? '' : 's'} · ${a.tracks.length} song${a.tracks.length === 1 ? '' : 's'}</div>
          </div>
          <${Icon} name="mdi:chevron-right" />
        </button>`)}
    </div>`;
}

function ArtistDetail ({ id }) {
  const a = db.artists.value.find(x => x.name === id);
  if (!a) return html`<${Empty} q="" />`;
  const albums = db.albums.value.filter(al => al.tracks.some(t => displayArtist(t) === id));
  return html`
    <div class="detail">
      <header class="detail-head">
        <${Cover} blob=${a.cover} size=${180} radius=${999} />
        <div class="detail-meta">
          <div class="detail-kind">Artist</div>
          <h1>${a.name}</h1>
          <div class="detail-sub">${a.albums.size} album${a.albums.size === 1 ? '' : 's'} · ${a.tracks.length} songs</div>
          <button class="btn primary" onClick=${() => player.play(a.tracks[0], a.tracks)}><${Icon} name="mdi:play" /> Play all</button>
        </div>
      </header>
      <aufbau-index class="albums" viewmode="grid" item-size="160px" gap="1.1rem">
        ${albums.map(al => html`
          <button class="album-card" key=${al.key} onClick=${() => go('album', al.key)}>
            <div class="album-art"><${Cover} blob=${al.cover} size=${160} radius=${10} /></div>
            <div class="album-name" title=${al.album}>${al.album}</div>
            <div class="album-artist">${al.year || ''}</div>
          </button>`)}
      </aufbau-index>
    </div>`;
}

function TrackList ({ tracks, numbered }) {
  return html`
    <div class="tracklist">
      ${tracks.map((t, i) => {
        const cur = player.current.value?.key === t.key;
        return html`
          <div class=${'tl-row' + (cur ? ' active' : '')} key=${t.key} onDblClick=${() => player.play(t, tracks)}>
            <button class="tl-no" onClick=${() => player.play(t, tracks)}>
              <span class="tl-num">${numbered ? (t.trackNo || i + 1) : i + 1}</span>
              <span class="tl-glyph"><${PlayGlyph} track=${t} /></span>
            </button>
            <span class="tl-title">${displayTitle(t)}</span>
            <span class="tl-artist">${displayArtist(t)}</span>
            <span class="tl-time">${fmtTime(t.duration)}</span>
          </div>`;
      })}
    </div>`;
}

function Empty ({ q }) {
  const has = db.sources.value.length > 0;
  return html`
    <div class="empty">
      <${Icon} name=${q ? 'mdi:magnify' : 'mdi:music-note-off-outline'} />
      <p>${q ? `Nothing matches “${q}”` : has ? 'No audio here yet — try Rescan or another folder.' : 'Add a folder of music to get started.'}</p>
      ${!has && !q && html`<button class="btn primary" onClick=${addFolder}><${Icon} name="mdi:folder-plus-outline" /> Add folder</button>`}
    </div>`;
}

// :::::: HEADER + PLAYER :::::::::::::::::::::::::::::::::::

function TopBar () {
  const r = route.value;
  const title = r.name === 'album' ? 'Album' : r.name === 'artist' ? 'Artist' : r.name[0].toUpperCase() + r.name.slice(1);
  const back  = r.name === 'album' || r.name === 'artist';
  return html`
    <header class="topbar">
      <button class="ibtn nav-toggle" aria-label="Menu" onClick=${() => navOpen.value = true}><${Icon} name="mdi:menu" /></button>
      ${back && html`<${IconButton} icon="arrow-left" label="Back" onClick=${() => go(r.name === 'album' ? 'albums' : 'artists')} />`}
      <h1 class="topbar-title">${title}</h1>
      <span class="topbar-count">${db.tracks.value.length} songs${db.pending.value ? ` · reading ${db.pending.value}…` : ''}</span>
      <span class="spacer"></span>
      <div class="searchbox">
        <${Icon} name="mdi:magnify" />
        <input type="search" placeholder="Search…" value=${search.value} onInput=${e => search.value = e.target.value} />
      </div>
      <button class="ibtn" title="Rescan" onClick=${() => db.rescanAll()} disabled=${!db.sources.value.length}><${Icon} name="mdi:refresh" /></button>
      <${AppSettings} />
    </header>`;
}

function Content () {
  switch (route.value.name) {
    case 'albums':  return html`<${AlbumsGrid} />`;
    case 'artists': return html`<${ArtistsList} />`;
    case 'album':   return html`<${AlbumDetail} id=${route.value.id} />`;
    case 'artist':  return html`<${ArtistDetail} id=${route.value.id} />`;
    default:        return html`<${SongsTable} />`;
  }
}

function PlayerBar () {
  const t = player.current.value;
  if (!t) return null;
  const dur = player.duration.value || t.duration || 0;
  return html`
    <footer class="player">
      <div class="np">
        <${Cover} blob=${t.cover} size=${48} radius=${6} />
        <div class="np-meta">
          <div class="np-title" title=${displayTitle(t)}>${displayTitle(t)}</div>
          <button class="np-artist" onClick=${() => go('artist', displayArtist(t))}>${displayArtist(t)}</button>
        </div>
      </div>

      <div class="controls">
        <div class="ctl-row">
          <button class=${'ctl' + (player.shuffle.value ? ' on' : '')} title="Shuffle" onClick=${player.toggleShuffle}><${Icon} name="mdi:shuffle-variant" /></button>
          <button class="ctl" title="Previous" onClick=${player.prev}><${Icon} name="mdi:skip-previous" /></button>
          <button class="ctl play" title="Play/Pause" onClick=${player.toggle}>
            <${Icon} name=${player.waiting.value ? 'svg-spinners:bars-scale-middle' : player.playing.value ? 'mdi:pause' : 'mdi:play'} />
          </button>
          <button class="ctl" title="Next" onClick=${() => player.next()}><${Icon} name="mdi:skip-next" /></button>
          <button class=${'ctl' + (player.repeat.value !== 'off' ? ' on' : '')} title=${'Repeat: ' + player.repeat.value} onClick=${player.cycleRepeat}>
            <${Icon} name=${player.repeat.value === 'one' ? 'mdi:repeat-once' : 'mdi:repeat'} />
          </button>
        </div>
        <div class="seek">
          <span class="t">${fmtTime(player.time.value)}</span>
          <input type="range" min="0" max=${dur || 0} step="0.1" value=${player.time.value}
                 onInput=${e => player.seek(+e.target.value)} />
          <span class="t">${fmtTime(dur)}</span>
        </div>
      </div>

      <div class="extra">
        <${Icon} name="mdi:volume-high" />
        <input class="vol" type="range" min="0" max="1" step="0.01" value=${player.volume.value}
               onInput=${e => player.setVolume(+e.target.value)} />
      </div>
    </footer>`;
}

// :::::: SCREENS :::::::::::::::::::::::::::::::::::::::::::

function Unsupported () {
  return html`
    <div class="hero">
      <${Icon} name="mdi:folder-alert-outline" />
      <h1>Can’t open folders here</h1>
      <p>This browser doesn’t support the File System Access API. Try a recent Chromium-based browser (Chrome, Edge, Brave…).</p>
    </div>`;
}

function Welcome () {
  return html`
    <div class="hero">
      <${Icon} name="mdi:music-box-multiple-outline" />
      <h1>Your music, on your device</h1>
      <p>Add a folder of audio files — tags and cover art are read locally and never leave your machine.</p>
      <button class="btn primary big" onClick=${addFolder}><${Icon} name="mdi:folder-plus-outline" /> Add a folder</button>
    </div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  useEffect(() => { db.load().catch(err => flash('Could not open the library: ' + err.message, 'err')); return dropCovers; }, []);

  if (!fs.supported())          return html`<div class="centered"><${Unsupported} /></div>`;
  if (!db.ready.value)          return html`<div class="centered"><div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div></div>`;
  if (!db.sources.value.length) return html`<div class="centered"><${Welcome} /></div>`;

  return html`
    <${Fragment}>
      <div id="app-main">
        <${Sidebar} />
        ${navOpen.value && html`<div class="scrim-mobile" onClick=${() => navOpen.value = false}></div>`}
        <main class="main">
          <${TopBar} />
          <div class="content"><${Content} /></div>
        </main>
      </div>
      <${PlayerBar} />
    </${Fragment}>`;
}

app.init({ App });
