// apps/podcasts/app.js

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::::

import { createThumbCache } from '/.shared/js/thumbs.js';

// :::::: APP ::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: HANDLE
// before anything is imported that reads the handle: a component captured at module
// scope sees whatever was on it at import time, and undefined stays undefined.
const { library, player } = await app.modules('library', 'player');

app.db      = app.database;
app.library = library;
app.player  = player;
app.thumbs  = createThumbCache();

const [{ Dock, Icon, Slot }, { PlayerPanel }] = await Promise.all([
  zugriff.components('Dock', 'Icon', 'Slot'),
  app.panels('PlayerPanel'),
]);

// :::: STATE
// dialog and route are declared by createState; this app's own keys go on the same
// store. nothing added here is persisted — a leaf has to ask for that.
app.state.route = { name: 'latest', id: null };

app.state.$extend({
  busy           : { type: String, value: '' },   // a label while a long task runs
  search         : { type: String, value: '' },   // shared episode filter, written by SearchPanel
  menuPosition   : { type: 'enum', values: ['top', 'bottom', 'left', 'right'], value: 'bottom' },
  playerPosition : { type: 'enum', values: ['top', 'bottom'], value: 'bottom' },

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
  'escape'      : { action: 'close-dialog', when: () => !!app.state.$dialog },

  'space'       : { action: 'toggle-play',   when: !!app.player.episode },
  'arrow-left'  : { action: 'skip-back',     when: !!app.player.episode },
  'arrow-right' : { action: 'skip-forward',  when: !!app.player.episode },
};

// :::::: EFFECTS

const $app = document.getElementById('app');
app.effect(() => {
  $app.dataset.menu   = app.state.$menuPosition;
  $app.dataset.player = app.state.$playerPosition;
});

// :::::: FRAME ::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { label: 'Episodes', icon: 'mdi:playlist-play',     view: 'latest'    },
  { label: 'Podcasts', icon: 'mdi:view-grid-outline', view: 'podcasts'  },
  { label: 'Later',    icon: 'bookmarks',             view: 'saved'     },
  { label: 'Explore',  icon: 'mdi:compass-outline',   view: 'explore'   },
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

  // explore routes on the feed url rather than an id — a podcast that is not
  // subscribed has no record to point at (views/ExplorePodcastView.js)
  explore           : 'ExploreView',
  'explore-podcast' : 'ExplorePodcastView',
};



function App () {
  const modal = app.state.$dialog;
  const route = app.state.$route;
  const view  = route.name in app.views ? route.name : 'latest';

  return html`<>
    <main id='app-main'>
      <${Slot} map=${app.views}   name=${view}  load='view' id=${route.id} />
      <${Slot} map=${app.dialogs} name=${modal} load='dialog' />
    </main>
    <${PlayerPanel} />
    <${Dock} items=${dockItems} />
  </>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });

