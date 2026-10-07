// apps/podcasts/app.js

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::::

import { gestalt }           from '@aufbau/api';
import { signal }            from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';

import { createThumbCache } from '/.shared/js/thumbs.js';
import { sharedSpec }       from '/.shared/js/components/Settings.js';

// :::::: APP ::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: HANDLE
// before anything is imported that reads the handle: a component captured at module
// scope sees whatever was on it at import time, and undefined stays undefined.
const { library, player } = await app.modules('library', 'player');

app.db      = app.database;
app.library = library;
app.player  = player;
app.thumbs  = createThumbCache();

const [{ Dock, Slot }, { PlayerPanel }, Export] = await Promise.all([
  zugriff.components('Dock', 'Slot'),
  app.panels('PlayerPanel'),
  app.component('Export'),
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
  'open-settings' : () => area('config')?.show(),

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

const show = app.show;
const area = app.area;

// the view on screen, and the id each detail view was last opened with. a detail
// view keeps its id while it is hidden, so it still shows its podcast on the way out
const current = signal('latest');
const ids     = signal({});

app.go = (name, id = null) => {
  if (id != null) ids.value = { ...ids.value, [name]: id };
  app.state.route = { name, id };
  show(name);
};

// the lists have a route, the details do not: an id is no part of the address, and a
// reload lands on the list the detail was opened from
const VIEWS = [
  { name: 'latest',          route: '/'         },
  { name: 'episode'                             },
  { name: 'podcasts',        route: '/podcasts' },
  { name: 'podcast'                             },
  { name: 'saved',           route: '/saved'    },
  { name: 'explore',         route: '/explore'  },
  { name: 'explore-podcast'                     },
];

// match: the detail views that keep their list's item active
const dockItems = [
  { label: 'Episodes', icon: 'mdi:playlist-play',     view: 'latest',   match: ['episode']         },
  { label: 'Podcasts', icon: 'mdi:view-grid-outline', view: 'podcasts', match: ['podcast']         },
  { label: 'Later',    icon: 'bookmarks',             view: 'saved'                                },
  { label: 'Explore',  icon: 'mdi:compass-outline',   view: 'explore',  match: ['explore-podcast'] },
  { label: 'Settings', icon: 'settings',              onClick: () => area('config')?.toggle()      },
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

// :::::: CONFIG ::::::::::::::::::::::::::::::::::::::::::::::

const FIELDS = {
  menuPosition   : { type: 'enum', label: 'Menu',   look: 'segments', values: ['top', 'bottom', 'left', 'right'], default: 'bottom' },
  playerPosition : { type: 'enum', label: 'Player', look: 'segments', values: ['top', 'bottom'],                  default: 'bottom' },
};

// the shared fields (palette, skin, …) and the app's own, all written into app.state
function Config () {
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let closed = false;

    gestalt.palettes().then(palettes => {
      if (closed) return;
      const spec = { ...sharedSpec(app.config, palettes), ...FIELDS };
      element.values = Object.fromEntries(Object.keys(spec).map(key => [key, app.state['$' + key]]));
      element.spec   = spec;
    });

    const onConfig = event => { app.state[event.detail.key] = event.detail.values[event.detail.key]; };
    element.addEventListener('config', onConfig);

    return () => { closed = true; element.removeEventListener('config', onConfig); };
  }, []);

  return html`
    <app-panel heading='Settings'>
      <app-config ref=${host}></app-config>
      <${Export} />
    </app-panel>
  `;
}

// :::::: ROOT ::::::::::::::::::::::::::::::::::::::::::::::::

// a detail view renders once it has been given an id
function View ({ name }) {
  const id     = ids.value[name] ?? null;
  const detail = !VIEWS.find(view => view.name === name).route;
  if (detail && id == null) return null;
  return html`<${Slot} map=${app.views} name=${name} load='view' id=${id} />`;
}

function onNavigate (event) {
  current.value   = event.detail.to;
  app.state.route = { name: event.detail.to, id: ids.value[event.detail.to] ?? null };
}

app.root.addEventListener('navigate', onNavigate);

// the areas of #app, the root
function App () {
  return html`
    <app-area name='main'>
      ${VIEWS.map(({ name, route }) => html`
        <app-view key=${name} name=${name} route=${route} transition-on='glide' active=${name === 'latest' || undefined}><${View} name=${name} /></app-view>
      `)}
      <${PlayerPanel} />
      <${Dock} items=${dockItems} current=${current.value} />
      <${Slot} map=${app.dialogs} name=${app.state.$dialog} load='dialog' />
    </app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
