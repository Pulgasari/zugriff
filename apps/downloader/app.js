// apps/downloader/app.js

// :::::: IMPORT

// the frame is aufbau's: an <app-root> with the views in its main area (queue,
// grabber, library), the selected download in a context area at the bottom and
// the settings in a config area at the end

import { computed }          from '@aufbau/signals';
import { useEffect }         from 'preact/hooks';

import { Config }            from './components/Config.js';
import { Detail }            from './components/Detail.js';
import { grabText, Grabber } from './components/Grabber.js';
import { PackageCard }       from './components/Rows.js';
import * as engine           from './modules/engine.js';
import * as frame            from './modules/frame.js';
import { usePlugins }        from './modules/plugins.js';

const { area, current, show } = frame;

const // shared components
Dock       = await zugriff.component('Dock'),
Empty      = await zugriff.component('Empty');

// :::::: APP

const app = zugriff.app;
app.db = app.database;

app.state.$extend({
  autostart  : { type: 'scalar', value: true,      persist: true },
  limit      : { type: 'scalar', value: 0,         persist: true },
  parallel   : { type: 'scalar', value: 3,         persist: true },
  perHost    : { type: 'scalar', value: 2,         persist: true },
  plugins    : { type: 'scalar', value: [],        persist: true },
  retries    : { type: 'scalar', value: 5,         persist: true },
  subfolders : { type: 'scalar', value: true,      persist: true },
  target     : { type: 'scalar', value: 'library', persist: true },
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
  'grab'      : () => show('grab'),
  'library'   : () => show('library'),
  'pause-all' : () => engine.active.peek().forEach(row => engine.pause(row.id)),
  'queue'     : () => show('queue'),
};

app.hotkeys = {
  'g'      : { action: 'grab' },
  'l'      : { action: 'library' },
  'q'      : { action: 'queue' },
  'escape' : { action: 'close', when: () => !!frame.selected.peek() },
};

// :::::: VIEWS

function Header ({ title, children }) {
  return html`
    <header>
      <h2>${title}</h2>
      ${children}
      <btn-icon icon='settings' title='settings' onClick=${() => area('config')?.toggle()} />
    </header>
  `;
}

function Queue () {
  const groups = queued.value;
  const { running, speed } = totals.value;

  return html`
    <div class='view'>
      <${Header} title='Queue'>
        ${running > 0 && html`<span class='status'>${running} running · ${zugriff.fmt.bytes(speed)}/s</span>`}
        ${engine.active.value.length > 0 && html`<btn-icon icon='lucide:pause' title='pause all' onClick=${app.actions['pause-all']} />`}
      <//>
      <main class='list'>
        ${groups.length
          ? groups.map(({ pack, rows }) => html`<${PackageCard} key=${pack?.id ?? 'none'} pack=${pack} rows=${rows} />`)
          : html`<${Empty} icon='lucide:download-cloud' title='Nothing in the queue' hint='paste links anywhere, or add them in the grabber' action=${html`<btn-tap icon='lucide:link' label='add links' onClick=${() => show('grab')} />`} />`}
      </main>
    </div>
  `;
}

function Grab () {
  return html`
    <div class='view'>
      <${Header} title='Grabber' />
      <main class='list'><${Grabber} /></main>
    </div>
  `;
}

function Library () {
  const groups = library.value;
  return html`
    <div class='view'>
      <${Header} title='Library' />
      <main class='list'>
        ${groups.length
          ? groups.map(({ pack, rows }) => html`<${PackageCard} key=${pack?.id ?? 'none'} pack=${pack} rows=${rows} />`)
          : html`<${Empty} icon='lucide:library' title='Nothing done yet' hint='finished downloads show here' />`}
      </main>
    </div>
  `;
}

// :::::: ROOT

// the dock's view items call app.go
app.go = name => show(name);

const dockItems = [
  { icon: 'lucide:list-video', label: 'queue',    view: 'queue'                            },
  { icon: 'lucide:link',       label: 'grabber',  view: 'grab'                             },
  { icon: 'lucide:library',    label: 'library',  view: 'library'                          },
  { icon: 'settings',          label: 'settings', onClick: () => area('config')?.toggle() },
];

function onNavigate (event) {
  current.value = event.detail.to;
}

app.root.addEventListener('navigate', onNavigate);

// the areas of #app, the root
function App () {
  useEffect(() => {
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      current.value = app.root.view?.getAttribute('name') ?? 'queue';
      fromShare();
    });
  }, []);

  return html`
    <app-area name='main'>
      <app-view name='queue'   route='/'        active><${Queue} /></app-view>
      <app-view name='grab'    route='/grab'    transition-on='glide'><${Grab} /></app-view>
      <app-view name='library' route='/library' transition-on='glide'><${Library} /></app-view>
      <${Dock} items=${dockItems} current=${current.value} />
    </app-area>
    <app-area name='context' dock='bottom' ontoggle=${event => { if (!event.detail?.open) frame.selected.value = null; }}><${Detail} /></app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// the tab title says how many run
app.effect(() => {
  const { running } = totals.value;
  document.title = running ? `(${running}) Downloader` : 'Downloader';
});

// :::::: BOOT

app.init({ App });
