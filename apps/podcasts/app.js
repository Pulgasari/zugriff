// apps/podcasts/app.js

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::::

import { signalStore } from '@aufbau/signals';
import { createThumbCache } from '/.shared/js/thumbs.js';

// :::::: APP ::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: HANDLE
// before anything is imported that reads the handle: a component captured at module
// scope sees whatever was on it at import time, and undefined stays undefined.
app.db       = app.database;
app.library  = await app.module('library');
app.player   = await app.module('player');
app.thumbs   = createThumbCache();

const // shared components
Dock = await zugriff.component('Dock'),
Icon = await zugriff.component('Icon'),
Slot = await zugriff.component('Slot');

const // panels
PlayerPanel = await app.panel('PlayerPanel');

// :::: STATE
// these three stay on app.state because shared code owns them: app.go() and the
// router drive route, app.setDialog() drives dialog, and SearchPanel writes search.
// everything below is this app's own, so it gets its own typed store.
app.state.dialog = null; // 'add' | 'settings' | null
app.state.route  = { name: 'latest', id: null };
app.state.search = '';

app.ui = signalStore({
  busy           : { type: String,   value: '' },     // a label while a long task runs
  menuPosition   : { type: 'enum',   values: ['top', 'bottom', 'left', 'right'], value: 'bottom' },
  playerPosition : { type: 'enum',   values: ['top', 'bottom'], value: 'bottom' },

  // listening progress, keyed by episode id. the one part of the library that does
  // not come out of the db per view — it is read per row and written while playing.
  progress       : { type: 'record', value: {} },
});

// the db is the library; only the schema and the progress table are read up front.
// a storage failure must not blank the app — it mounts either way, just empty.
await app.library.load().catch(error => app.toast.error(error));
app.db.podcasts.toValues().then(rows => app.thumbs.prewarm(rows.map(podcast => podcast.image)));

// :::::: ACTIONS

async function refreshAll () {
  if (!await app.db.podcasts.count()) { app.state.dialog = 'add'; return; }
  app.ui.busy = 'Refreshing…';
  try {
    const results = await app.library.refreshAll((n, total) => app.ui.busy = `Refreshing ${n}/${total}…`);
    const added   = results.reduce((sum, r) => sum + (r.added || 0), 0);
    const failed  = results.filter(r => r.error).length;
    const type    = failed ? 'error' : 'success';
    const message = `${added} new episode(s), ${failed} feed(s) failed.`;
    app.toast({ message, type });
  }
  finally { app.ui.busy = ''; }
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
  $app.dataset.menu   = app.ui.$menuPosition;
  $app.dataset.player = app.ui.$playerPosition;
});

// :::::: FRAME ::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { label: 'Episodes', icon: 'mdi:playlist-play',     view: 'episodes'  },
  { label: 'Podcasts', icon: 'mdi:view-grid-outline', view: 'podcasts'  },
  { label: 'Later',    icon: 'bookmarks',             view: 'episodes'  },     
//{ label: 'Settings', icon: 'settings',            dialog: 'settings' },
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

