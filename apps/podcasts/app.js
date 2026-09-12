// apps/podcasts/app.js

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::::

import { useEffect } from 'preact/hooks';
import { typedSignal, oneOf, text, local } from '@aufbau/signals';
import { createThumbCache } from '/.shared/js/thumbs.js';
import { DEFAULT_PROXY } from './modules/feed.js';

const // shared components
Dock = await zugriff.component('Dock'),
Icon = await zugriff.component('Icon'),
Slot = await zugriff.component('Slot');

const // panels
PlayerPanel   = await app.panel('PlayerPanel'),
SettingsPanel = await app.panel('SettingsPanel');

const 
URL_PROXY_IMG = 'https://img.pulgasari.dev/?url={url}&w={w}',
URL_PROXY_RSS = 'https://api.allorigins.win/raw?url={url}';

// :::::: APP ::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: HANDLE
app.db     = await app.module('db');
app.player = await app.module('player');

// :::: STATE
app.state.route  = { name: 'latest', id: null };   // { name, id }
app.state.search = '';   // shared episode filter
app.state.dialog = null; // 'add' | 'settings' | null
app.state.busy   = '';   // a label while a long task runs

// ::: SETTINGS
app.settings = typedSignal({
  podcastSort : oneOf(['recent', 'alpha'], 'recent'),
  episodeSort : oneOf(['newest', 'oldest', 'alpha'], 'newest'),
  view        : oneOf(['grid', 'list'], 'grid'),
  menuPos     : oneOf(['top', 'bottom', 'left', 'right'], 'bottom'),
  playerPos   : oneOf(['top', 'bottom'], 'bottom'),
  //proxy       : text(DEFAULT_PROXY),
  //imgResizer  : text(DEFAULT_IMG_RESIZER),
}, { key: 'zugriff:podcasts:settings', store: local });

// on-device artwork thumbnail cache, resized through the configured endpoint
const buildResizer = (url, w) => {
  const tpl = app.settings.imgResizer.trim();
  if (!tpl || !url) return null;
  return tpl.replaceAll('{url}', encodeURIComponent(url)).replaceAll('{w}', String(w));
};
app.thumbs = createThumbCache({ resizer: buildResizer });

// ::: navigation — navigating always clears the current filter. for toasts call
// app.toast directly (see .shared/js/modules/toast.js).
app.go = (name, id) => { app.state.route = { name, id: id ?? null }; app.state.search = ''; };

// :::::: ACTIONS

async function refreshAll () {
  if (!app.db.podcasts.size) { app.state.dialog = 'add'; return; }
  app.state.busy = 'Refreshing…';
  try {
    const results = await app.db.refreshAll(URL_PROXY_RSS, (n, total) => app.state.busy = `Refreshing ${n}/${total}…`);
    const added   = results.reduce((sum, r) => sum + (r.added || 0), 0);
    const failed  = results.filter(r => r.error).length;
    const type    = failed ? 'error' : 'success';
    const message = `${added} new episode(s), ${failed} feed(s) failed.`;
    app.toast({ message, type });
  }
  finally { app.state.busy = ''; }
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

app.hotkeys = {
  'escape'      : { action: 'close-dialog', when: () => !!app.state.dialog },

  'space'       : { action: 'toggle-play',   when: !!app.player.episode },
  'arrow-left'  : { action: 'skip-back',     when: !!app.player.episode },
  'arrow-right' : { action: 'skip-forward',  when: !!app.player.episode },
};

// :::::: EFFECTS
// the frame reads menu/player placement off #app's data-attributes; keep them in sync
// so the layout responds without an extra wrapper element

const $app = document.getElementById('app');
app.effect(() => {
  $app.dataset.menu   = app.settings.menuPos;
  $app.dataset.player = app.settings.playerPos;
});

// :::::: FRAME ::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { label: 'Podcasts', icon: 'mdi:view-grid-outline', view: 'podcasts'  },
  { label: 'Episodes', icon: 'mdi:playlist-play',     view: 'episodes'  },
  { label: 'Later',    icon: 'bookmarks',             view: 'episodes'  },     
  { label: 'Settings', icon: 'settings',            dialog: 'settings' },
];

app.views = {
  latest   : 'LatestView',
  episode  : 'EpisodeDetailView',
  podcasts : 'PodcastsView',
  podcast  : 'PodcastDetailView',
  saved    : 'SavedView',
};

app.dialogs = {
  add      : 'AddPodcastDialog',
  //settings : 'panels/SettingsPanel',
};

function App () {
  useEffect(() => {
    app.db.load()
      .then(() => app.thumbs.prewarm(app.db.podcasts.all.map(p => p.image)))
      .catch(app.toast);
  }, []);

  if (!app.db.ready) return html`<div class="booting"><${Icon} name='loading' /></div>`;

  const route = app.state.route;
  const view  = route.name in app.views ? route.name : 'latest';

  return html`<>
    <main id='app-main'>
      <${Slot} map=${app.views} name=${view} load='view' id=${route.id} />
    </main>
    <${PlayerPanel} />
    <${Dock} items=${dockItems} />
    <${Slot} map=${app.dialogs} name=${app.state.dialog} load='dialog' />
  </>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });

