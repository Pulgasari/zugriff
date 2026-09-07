// apps/podcasts/app.js
/*
ich hab hier in erster linie erstmal bissl aufgeräumt, um einen überblick zu verschaffen.  
was wir bei `code` neu eingeführt hatten bzgl app-struktur gilt im prinzip auch hier.
darüberhinaus ergaben sich noch ein paar weitere neuerungen:

1. unterteilung in: views, panels, components

2. die runtime sollte ein ein trigger-system und ein hotkeys-system bekommen 
vermutlich als:
/.shared/modules/hotkeys.js
/.shared/modules/triggers.js

(vllt wäre der name 'actions' besser für 'triggers' ???)

der zweck von 'triggers' ist:
1. reduzierung von boilerplate von standardzeug, dass sich fast jede app teilt
2. app bekommt sauberes (optionales) system um ...
3. zusätzlich ibtegriert es sich super mit hotkeys

der zweck von 'hotkeys':
1. handy möglichkeit um mit keyboaord iwas in app zu machen
2. tastencode + callback-function oder trigger-id
(in `zugriff/.shared/js/modules/hotkeys.js` habe hierfür schon einen kleinen entwurf hinterlegt)   

in der praxis stell ich mir das ungefähr so vor:

zugriff.app.actions
zugriff.app.hotkeys

const app = zugriff.app;

app.actions = {
  refreshEpisodes : () => {...},
  refreshPodcasts : () => {...},
};

app.actions.refreshEpisodes = () => {...};
app.actions.refreshPodcasts = () => {...};

app.action.add('refresh-episodes', () => {...});
app.action.add('refresh-podcasts', () => {...});

die keys sind canonical kebabcase, camelcase, snakecase.
ein passendes CanonicalMap klasse haben wir dafür auch schon:
(importierbar als: `import CanonicalMap from '@pulgasari/canonicalmap';`)

ich zitiere es hier nur damit du den inhalt kennst:
===================================================
// @pulgasari/canonicalmap

import str from './str.js';

const FORMS = {
  camel    : str.toCamelCase,    // userProfileStatus
  constant : str.toConstantCase, // USER_PROFILE_STATUS
  kebab    : str.toKebabCase,    // user-profile-status
  pascal   : str.toPascalCase,   // UserProfileStatus
  snake    : str.toSnakeCase,    // user_profile_status
};

const toConverter = (form) => typeof form === 'function' ? form : FORMS[form];

const toEntries = (source) =>
    source == null                                  ? []
  : typeof source[Symbol.iterator] === 'function'   ? source
  : Object.entries(source);

export class CanonicalMap extends Map {
  constructor (source, forms = ['camel', 'kebab', 'snake']) {
    super();

    this.forms     = forms.map(toConverter).filter(Boolean);
    if (!this.forms.length) this.forms = [FORMS.camel];
    this.canonical = this.forms[0];
    this.aliases   = new Map;
    this.cache     = new Map;

    for (const [key, value] of toEntries(source)) this.set(key, value);
  }

  static from (source, forms) {
    return new CanonicalMap(source, forms);
  }

  key (rawKey) {
    if (typeof rawKey !== 'string') return rawKey;

    const alias = this.aliases.get(rawKey);
    if (alias !== undefined) return alias;

    const cached = this.cache.get(rawKey);
    if (cached !== undefined) return cached;

    const key = this.canonical(rawKey);
    this.cache.set(rawKey, key);
    return key;
  }

  set (rawKey, value) {
    if (typeof rawKey !== 'string') return super.set(rawKey, value);

    const key = this.aliases.get(rawKey) ?? this.canonical(rawKey);

    if (!super.has(key)) {
      this.aliases.set(rawKey, key);
      for (const form of this.forms) this.aliases.set(form(key), key);
    }

    return super.set(key, value);
  }

  get (rawKey) { return super.get(this.key(rawKey)); }
  has (rawKey) { return super.has(this.key(rawKey)); }

  delete (rawKey) {
    const key = this.key(rawKey);
    for (const [alias, target] of this.aliases) if (target === key) this.aliases.delete(alias);
    return super.delete(key);
  }

  clear () {
    this.aliases.clear();
    this.cache.clear();
    return super.clear();
  }

  merge (source) {
    for (const [key, value] of toEntries(source)) this.set(key, value);
    return this;
  }

  toObject (form) {
    const convert = form ? toConverter(form) : null;
    const result  = {};
    for (const [key, value] of this) result[convert ? convert(key) : key] = value;
    return result;
  }
}

export default CanonicalMap;
===================================================
*/

// :::::: IMPORT
import { computed, effect, signal } from '@aufbau/signals';
import { useSignal }                from '@aufbau/signals/hooks';
import { useEffect, useRef }        from 'preact';

import { 
  fmtDate, fmtDuration, 
  plain, paragraphs,
  filterEpisodes, sortEpisodes, sortPodcasts,
} from './methods.js';

const // :::::: COMPONENTS (SHARED) ::::::::::::::::::
Button      = await zugriff.component('Button'),
Empty       = await zugriff.component('Empty'),
Icon        = await zugriff.component('Icon'),
IconButton  = await zugriff.component('IconButton'),
Settings    = await zugriff.component('Settings');

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
AddPodcastPanel = await app.panel('AddPodcastPanel'),
PlayerPanel     = await app.panel('PlayerPanel'),
SearchPanel     = await app.panel('SearchPanel'),
SidebarPanel    = await app.panel('SidebarPanel');

const // :::::: VIEWS :::::::::::::::::::::::::::::::
EpisodeDetailView   = await app.view('LatestView'),
LatestView          = await app.view('LatestView'),
EpisodePodcastView  = await app.view('LatestView'),
PodcastsView        = await app.view('PodcastsView'),
SavedView           = await app.view('SavedView'),
SettingsView        = await app.view('SettingsView');

// ::: shared
import { stored }               from '/.shared/js/app/signals.js';
import { createThumbCache }     from '/.shared/js/thumbs.js';

// ::: local
import * as db           from './db.js';
import * as player       from './player.js';
import { DEFAULT_PROXY } from './feed.js';

const DEFAULT_IMG_RESIZER = 'https://img.pulgasari.dev/?url={url}&w={w}';

// :::::: SETTINGS (persisted signals) ::::::::::::::::::::::

// gehört nach PodcastsPanel intern
const podcastSort = stored('recent', 'podcasts:podcast-sort');   // recent | alpha
const view        = stored('grid',   'podcasts:view');           // grid | list

// gehört nach EpisodesPanel intern
const episodeSort = stored('newest', 'podcasts:episode-sort');   // newest | oldest | alpha

// gehört zum app.state bzw SettingsPanel
const menuPos     = stored('bottom', 'podcasts:menu-pos');       // top | bottom | left | right
const playerPos   = stored('bottom', 'podcasts:player-pos');     // top | bottom
const proxy       = stored(DEFAULT_PROXY, 'podcasts:proxy');
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


// :::::: VIEWS :::::::::::::::::::::::::::::::::::::::::::::





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
