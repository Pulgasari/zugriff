// apps/podcasts/app.js

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::::

import { createThumbCache } from '/.shared/js/thumbs.js';

const // shared components
Dock = await zugriff.component('Dock'),
Icon = await zugriff.component('Icon'),
Slot = await zugriff.component('Slot');

const // panels
PlayerPanel = await app.panel('PlayerPanel');

// :::::: APP ::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: HANDLE
app.db       = await app.module('database');
app.library  = await app.module('library');
app.player   = await app.module('player');
app.thumbs   = createThumbCache();

// :::: STATE
app.state.busy   = '';   // a label while a long task runs
app.state.dialog = null; // 'add' | 'settings' | null
app.state.route  = { name: 'latest', id: null };   // { name, id }
app.state.search = '';   // shared episode filter
app.state.menuPosition   = 'bottom';
app.state.playerPosition = 'bottom';

// ::: LIBRARY
app.state.podcasts = [];
app.state.episodes = [];
app.state.progress = {};

// filled once, before the first render, so the views stay synchronous. a storage
// failure must not blank the app — it mounts either way, just empty.
await app.library.load().catch(error => app.toast.error(error));
app.thumbs.prewarm(app.library.getPodcasts().map(podcast => podcast.image));

// :::::: ACTIONS

async function refreshAll () {
  if (!app.library.getPodcasts().length) { app.state.dialog = 'add'; return; }
  app.state.busy = 'Refreshing…';
  try {
    const results = await app.library.refreshAll((n, total) => app.state.busy = `Refreshing ${n}/${total}…`);
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

const $app = document.getElementById('app');
app.effect(() => {
  $app.dataset.menu   = app.state.menuPosition;
  $app.dataset.player = app.state.playerPosition;
});

// :::::: FRAME ::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { label: 'Episodes', icon: 'mdi:playlist-play',     view: 'episodes'  },
  { label: 'Podcasts', icon: 'mdi:view-grid-outline', view: 'podcasts'  },
  { label: 'Later',    icon: 'bookmarks',             view: 'episodes'  },     
  { label: 'Settings', icon: 'settings',            dialog: 'settings' },
];

app.dialogs = {
  add : 'AddPodcastDialog',
};

app.views = {
  latest   : 'LatestView',
  episode  : 'EpisodeDetailView',
  podcasts : 'PodcastsView',
  podcast  : 'PodcastDetailView',
  saved    : 'SavedView',
};



function App () {
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

