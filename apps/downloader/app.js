// apps/downloader/app.js

// :::::: IMPORT

// the frame is aufbau's: an <app-root> with the views in its main area (queue,
// grabber, library), the selected download in a context area at the bottom and
// the settings in a config area at the end

import { computed }          from '@aufbau/signals';
import { useEffect }         from '/.shared/js/vendors.js';

import { ConfigSections }    from './components/Config.js';
import { Detail }            from './components/Detail.js';
import { grabText, Grabber } from './components/Grabber.js';
import { PackageCard }       from './components/Rows.js';
import * as engine           from './modules/engine.js';
import * as frame            from './modules/frame.js';
import { usePlugins }        from './modules/plugins.js';

const { Config, Dock, Empty, ViewHeader, Views } = await zugriff.components('Config', 'Dock', 'Empty', 'ViewHeader', 'Views');

// :::::: APP

const app  = zugriff.app;
const area = app.area;
app.db = app.database;

// the queue's settings, persisted, in the config area after the shared ones
app.settings = {
  parallel   : { type: 'number',  label: 'At once',              min: 1, max: 8,     step: 1,   default: 3 },
  perHost    : { type: 'number',  label: 'At once per host',     min: 1, max: 4,     step: 1,   default: 2 },
  retries    : { type: 'number',  label: 'Tries',                min: 1, max: 10,    step: 1,   default: 5 },
  limit      : { type: 'number',  label: 'Limit, KiB/s',         min: 0, max: 20480, step: 256, default: 0 },
  target     : { type: 'enum',    label: 'Target',               look: 'segments', values: ['library', 'folder', 'webdav', 'save'], default: 'library' },
  subfolders : { type: 'boolean', label: 'A folder per package', default: true },
  autostart  : { type: 'boolean', label: 'Go on at start',       default: true },
};

app.state.$extend({
  plugins : { type: 'scalar', value: [], persist: true },
});

await engine.load().catch(app.toast);
usePlugins(app.state.$plugins);

// :::::: QUERIES

const byPackage = rows => {
  const groups = new Map;
  for (const row of rows) {
    if (!groups.has(row.package)) groups.set(row.package, []);
    groups.get(row.package).push(row);
  }
  return [...groups].map(([id, items]) => ({ pack: engine.packages.value.find(item => item.id === id), rows: items.sort((a, b) => a.created - b.created) }))
    .sort((a, b) => (b.pack?.created ?? 0) - (a.pack?.created ?? 0));
};

// a package stays in the queue while one of its downloads is not done
const queued  = computed(() => byPackage(engine.downloads.value.filter(row => engine.downloads.value.some(item => item.package === row.package && item.state !== 'done'))));
const library = computed(() => byPackage(engine.downloads.value.filter(row => row.state === 'done' && !engine.downloads.value.some(item => item.package === row.package && item.state !== 'done'))));

const totals = computed(() => {
  const meters = Object.values(engine.live.value);
  return { running: engine.downloads.value.filter(row => row.state === 'running').length, speed: meters.reduce((sum, meter) => sum + (meter.speed ?? 0), 0) };
});

// :::::: LINKS IN

// shared into the app (the manifest's share_target), pasted or dropped anywhere
async function fromShare () {
  const params = new URLSearchParams(location.search);
  const text   = ['title', 'text', 'url'].map(key => params.get(key)).filter(Boolean).join(' ');
  if (!text) return;
  history.replaceState(null, '', location.pathname + location.hash);
  await grabText(text);
}

const typing = event => event.composedPath().some(node => node.localName === 'textarea' || node.localName === 'input' || node.isContentEditable);

document.addEventListener('paste', event => {
  if (typing(event)) return;
  const text = event.clipboardData?.getData('text');
  if (text) { event.preventDefault(); grabText(text); }
});

document.addEventListener('dragover', event => { if (event.dataTransfer?.types.some(type => type === 'text/uri-list' || type === 'text/plain')) event.preventDefault(); });
document.addEventListener('drop', event => {
  const text = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain');
  if (!text) return;
  event.preventDefault();
  grabText(text);
});

// :::::: ACTIONS

app.actions = {
  'close'     : () => frame.closeDetail(),
  'grab'      : () => app.go('grab'),
  'library'   : () => app.go('library'),
  'pause-all' : () => engine.active.peek().forEach(row => engine.pause(row.id)),
  'queue'     : () => app.go('queue'),
};

app.hotkeys = {
  'g'      : { action: 'grab' },
  'l'      : { action: 'library' },
  'q'      : { action: 'queue' },
  'escape' : { action: 'close', when: () => !!frame.selected.peek() },
};

// :::::: VIEWS

// the predefined header, the settings always last
function Header ({ title, children }) {
  const tools = html`${children}<btn-icon icon='settings' title='settings' onClick=${() => area('config')?.toggle()} />`;
  return html`<${ViewHeader} title=${title} tools=${tools} />`;
}

function Queue () {
  const groups = queued.value;
  const { running, speed } = totals.value;

  return html`
    <${Header} title='Queue'>
      ${running > 0 && html`<span class='status'>${running} running · ${zugriff.fmt.bytes(speed)}/s</span>`}
      ${engine.active.value.length > 0 && html`<btn-icon icon='lucide:pause' title='pause all' onClick=${app.actions['pause-all']} />`}
    <//>
    <main class='list'>
      ${groups.length
        ? groups.map(({ pack, rows }) => html`<${PackageCard} key=${pack?.id ?? 'none'} pack=${pack} rows=${rows} />`)
        : html`<${Empty} icon='lucide:download-cloud' title='Nothing in the queue' hint='paste links anywhere, or add them in the grabber' action=${html`<btn-push icon='lucide:link' label='add links' onClick=${() => app.go('grab')} />`} />`}
    </main>
  `;
}

function Grab () {
  return html`
    <${Header} title='Grabber' />
    <main class='list'><${Grabber} /></main>
  `;
}

function Library () {
  const groups = library.value;
  return html`
    <${Header} title='Library' />
    <main class='list'>
      ${groups.length
        ? groups.map(({ pack, rows }) => html`<${PackageCard} key=${pack?.id ?? 'none'} pack=${pack} rows=${rows} />`)
        : html`<${Empty} icon='lucide:library' title='Nothing done yet' hint='finished downloads show here' />`}
    </main>
  `;
}

// :::::: ROOT

app.views = {
  queue   : { route: '/',        view: Queue   },
  grab    : { route: '/grab',    view: Grab    },
  library : { route: '/library', view: Library },
};

const dockItems = [
  { icon: 'lucide:list-video', label: 'queue',    view: 'queue'                            },
  { icon: 'lucide:link',       label: 'grabber',  view: 'grab'                             },
  { icon: 'lucide:library',    label: 'library',  view: 'library'                          },
  { icon: 'settings',          label: 'settings', onClick: () => area('config')?.toggle() },
];

// the areas of #app, the root
function App () {
  useEffect(() => {
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(fromShare);
  }, []);

  return html`
    <app-area name='main'>
      <${Views} transition-on='glide' />
      <${Dock} items=${dockItems} />
    </app-area>
    <app-area name='context' dock='bottom' ontoggle=${event => { if (!event.detail?.open) frame.selected.value = null; }}><${Detail} /></app-area>
    <app-area name='config' dock='end'>
      <${Config} onChange=${key => key in app.settings && engine.pump()}><${ConfigSections} /></${Config}>
    </app-area>
  `;
}

// the tab title says how many run
app.effect(() => {
  const { running } = totals.value;
  document.title = running ? `(${running}) Downloader` : 'Downloader';
});

// :::::: BOOT

app.init({ App });
