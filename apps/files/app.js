// apps/files/app.js
// a file manager over one granted folder, built on aufbau's app-root / app-view
// and aufbau-index. the runtime binds zugriff (+ zugriff.app, html) to window
// before this runs, so nothing here imports the runtime.
//
// views:
//   library   the folder, browsed (route /)
//   preview   one file (route /preview), a sketch for now
//   settings  how the app behaves and which folder it shows (route /settings)
//
// the views switch through app-root's hash routing, not through zugriff's
// route state: the address is the state, back and forward work as they should.

// :::::: IMPORT ::::::::::::::::::::::::::::::::::::::::::::::

import { autoloader }     from '@aufbau/components';
import { effect, signal } from '@aufbau/signals';

import { useEffect, useRef } from 'preact/hooks';

import Button   from '/.shared/js/components/Button.js';
import Dock     from '/.shared/js/components/Dock.js';
import Icon     from '/.shared/js/components/Icon.js';
import Settings from '/.shared/js/components/Settings.js';

// app-*, input-* and the rest of the components. the elements come with aufbau.boot()
autoloader({ elements: false });

// :::::: HANDLE ::::::::::::::::::::::::::::::::::::::::::::::

const app = zugriff.app;
const fs  = zugriff.fs;

app.db = await app.module('db');

// open: how an entry opens. auto is a tap on touch screens and a double click with a mouse
app.state.$extend({
  open     : { type: 'enum', value: 'auto', values: ['auto', 'double', 'single'] },
  viewmode : { type: 'enum', value: 'grid', values: ['grid', 'list'] },
});

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::::

const path     = signal([]);      // the folders below the root, by name
const entries  = signal([]);      // the listing of path
const loading  = signal(false);   // a listing is on its way, the old one is gone already
const query    = signal('');      // the live filter
const selected = signal(null);    // the entry a single click picked (double mode)
const file     = signal(null);    // the entry in the preview
const current  = signal('library');

const rootRef = { current: null };
const show    = name => rootRef.current?.show(name);

const touch      = () => globalThis.matchMedia?.('(pointer: coarse)').matches;
const opensOnTap = () => app.state.$open === 'single' || (app.state.$open === 'auto' && touch());

// :::::: FILES :::::::::::::::::::::::::::::::::::::::::::::::

const rootHandle = () => app.db.perm.value === 'granted' ? app.db.folder.value?.handle ?? null : null;

// the listing follows the folder, its permission and the path by itself. the
// old listing goes at once: its entries would still open against the new path
// while a big folder loads. the last request wins, a late answer is dropped
let request = 0;
effect(() => {
  const root = rootHandle();
  const at   = path.value;
  const own  = ++request;

  entries.value = [];
  loading.value = Boolean(root);
  if (!root) return;

  fs.list(root, at)
    .then (list => { if (own === request) entries.value = list; })
    .catch(err  => { if (own === request) app.toast.error(err); })
    .finally(()  => { if (own === request) loading.value = false; });
});

function goTo (next) {
  path.value     = next;
  selected.value = null;
}

function open (entry) {
  if (entry.kind === 'directory') return goTo([...path.value, entry.name]);
  file.value = { ...entry, path: path.value };
  show('preview');
}

// a tap opens, or a click picks and a double click opens, see opensOnTap()
function onEntryClick (entry) {
  if (opensOnTap()) return open(entry);
  selected.value = entry.name;
}

const visible = () => {
  const needle = query.value.trim().toLowerCase();
  return needle ? entries.value.filter(entry => entry.name.toLowerCase().includes(needle)) : entries.value;
};

const formatSize = (bytes = 0) =>
    bytes < 1024        ? `${bytes} B`
  : bytes < 1024 ** 2   ? `${(bytes / 1024).toFixed(1)} KB`
  : bytes < 1024 ** 3   ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
  :                       `${(bytes / 1024 ** 3).toFixed(1)} GB`;

const iconOf = entry =>
    entry.kind === 'directory'          ? 'lucide:folder'
  : entry.type?.startsWith('image/')    ? 'lucide:image'
  : entry.type?.startsWith('audio/')    ? 'lucide:music'
  : entry.type?.startsWith('video/')    ? 'lucide:film'
  : entry.type?.startsWith('text/')     ? 'lucide:file-text'
  :                                       'lucide:file';

// :::::: FOLDER ::::::::::::::::::::::::::::::::::::::::::::::

async function chooseFolder () {
  if (!fs.supported()) return;
  try         { await app.db.grant(); goTo([]); }
  catch (err) { console.warn('[files] grant failed', err); }
}

async function reconnect () {
  const result = await app.db.reconnect();
  if (!result.granted) return chooseFolder();
  goTo([]);
}

async function closeFolder () {
  if (!confirm('Close this folder? Your files are untouched, only the app forgets it.')) return;
  await app.db.forget();
}

// :::::: LIBRARY :::::::::::::::::::::::::::::::::::::::::::::

function Hero ({ icon, title, children }) {
  return html`
    <div-y class='hero'>
      <${Icon} name=${icon} />
      <h1>${title}</h1>
      ${children}
    </div-y>
  `;
}

function Entry ({ entry }) {
  const isSelected = selected.value === entry.name;
  return html`
    <aufbau-item>
      <button class=${isSelected ? 'entry selected' : 'entry'}
              aria-pressed=${isSelected ? 'true' : null}
              onClick=${() => onEntryClick(entry)}
              onDblClick=${() => open(entry)}
              onKeyDown=${event => event.key === 'Enter' && !opensOnTap() && (event.preventDefault(), open(entry))}>
        <${Icon} name=${iconOf(entry)} />
        <span class='name'>${entry.name}</span>
        ${entry.kind === 'file' && html`<small>${formatSize(entry.size)}</small>`}
      </button>
    </aufbau-item>
  `;
}

function Toolbar () {
  const crumbs = useRef(null);

  // the crumbs speak an event of their own, preact knows only standard ones
  useEffect(() => {
    const element = crumbs.current;
    const onCrumb = event => goTo(event.detail.path.split('/').filter(Boolean));
    element?.addEventListener('aufbau-crumbs', onCrumb);
    return () => element?.removeEventListener('aufbau-crumbs', onCrumb);
  }, []);

  return html`
    <div-x class='toolbar'>
      <aufbau-crumbs ref=${crumbs} root=${app.db.folder.value?.name ?? 'folder'} path=${'/' + path.value.join('/')}></aufbau-crumbs>
      <input-search placeholder='filter' onsearch=${event => { query.value = event.detail.query; }}></input-search>
      <aufbau-picker look='segments' icons-only value=${app.state.$viewmode}
                     onchange=${event => { app.state.viewmode = event.target.value; }}>
        <aufbau-option value='grid' icon='lucide:layout-grid'>grid</aufbau-option>
        <aufbau-option value='list' icon='lucide:list'>list</aufbau-option>
      </aufbau-picker>
    </div-x>
  `;
}

function Library () {
  if (!fs.supported()) return html`
    <${Hero} icon='alert' title="Can't open folders here">
      <p>This browser has no File System Access API. Try a recent Chromium based browser.</p>
    </${Hero}>
  `;

  if (!app.db.ready.value) return html`<${Icon} name='loading' />`;

  if (!app.db.folder.value) return html`
    <${Hero} icon='folder-open' title='Browse a folder'>
      <p>Pick a folder of your device, it becomes the root. Nothing is uploaded or copied.</p>
      <${Button} icon='folder-add' label='Open a folder' onClick=${chooseFolder} />
    </${Hero}>
  `;

  if (app.db.perm.value !== 'granted') return html`
    <${Hero} icon='folder-key' title=${`Reconnect “${app.db.folder.value.name}”`}>
      <p>This folder needs permission again for this visit.</p>
      <${Button} icon='folder-key' label='Reconnect' onClick=${reconnect} />
    </${Hero}>
  `;

  const list = visible();

  return html`
    <${Toolbar} />
    ${loading.value ? html`<${Icon} name='loading' />`
    : list.length
      ? html`<aufbau-index viewmode=${app.state.$viewmode} item-size='7rem'>${list.map(entry => html`<${Entry} key=${entry.name} entry=${entry} />`)}</aufbau-index>`
      : html`<p class='empty'>${query.value ? 'nothing matches the filter' : 'this folder is empty'}</p>`}
  `;
}

// :::::: PREVIEW :::::::::::::::::::::::::::::::::::::::::::::
// a sketch: name, size, an image inline, download

function Preview () {
  const entry = file.value;
  const url   = useRef(null);
  const image = useRef(null);

  useEffect(() => {
    if (!entry || !entry.type?.startsWith('image/')) return;
    let cancelled = false;
    fs.readFile(rootHandle(), entry.path, entry.name).then(blob => {
      if (cancelled || !image.current) return;
      url.current = URL.createObjectURL(blob);
      image.current.src = url.current;
    });
    return () => { cancelled = true; if (url.current) URL.revokeObjectURL(url.current); };
  }, [entry]);

  if (!entry) return html`<p class='empty'>no file open</p>`;

  const download = async () => {
    const blob = await fs.readFile(rootHandle(), entry.path, entry.name);
    const link = Object.assign(document.createElement('a'), { download: entry.name, href: URL.createObjectURL(blob) });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return html`
    <div-y class='preview'>
      <div-x class='toolbar'>
        <${Button} icon='lucide:arrow-left' label='back' onClick=${() => history.back()} />
        <h1>${entry.name}</h1>
      </div-x>
      ${entry.type?.startsWith('image/') ? html`<img ref=${image} alt=${entry.name} />` : html`<${Icon} name=${iconOf(entry)} />`}
      <p>${entry.type || 'unknown type'} · ${formatSize(entry.size)}</p>
      <${Button} icon='lucide:download' label='download' onClick=${download} />
    </div-y>
  `;
}

// :::::: SETTINGS ::::::::::::::::::::::::::::::::::::::::::::

const FIELDS = {
  open : {
    type    : 'enum',
    label   : 'Open with',
    look    : 'segments',
    values  : [['auto', 'auto'], ['single', 'a tap'], ['double', 'a double click']],
    default : 'auto',
  },
};

function SettingsView () {
  const folder = app.db.folder.value;
  return html`
    <div-y class='settings'>
      <h1>Settings</h1>
      <${Settings} fields=${FIELDS} values=${{ open: app.state.$open }}
                   onChange=${(values, key) => { if (key === 'open') app.state.open = values.open; }} />
      <h2>Folder</h2>
      ${folder
        ? html`
          <p><${Icon} name='folder-open' /> ${folder.name}</p>
          <div-x class='actions'>
            <${Button} icon='mdi:folder-swap-outline' label='change' onClick=${chooseFolder} />
            <${Button} icon='close' label='close' onClick=${closeFolder} />
          </div-x>`
        : html`<${Button} icon='folder-add' label='Open a folder' onClick=${chooseFolder} />`}
    </div-y>
  `;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::::

const dockItems = [
  { label: 'Files',    icon: 'lucide:folder',   match: ['library', 'preview'], onClick: () => show('library')  },
  { label: 'Settings', icon: 'settings',        match: ['settings'],           onClick: () => show('settings') },
];

function App () {
  const root = useRef(null);

  useEffect(() => {
    rootRef.current = root.current;
    app.db.load().catch(err => console.warn('[files] load failed', err));
  }, []);

  return html`
    <app-root ref=${root} routing='hash' onnavigate=${event => { current.value = event.detail.to; }}>
      <app-view name='library' route='/' active><${Library} /></app-view>
      <app-view name='preview' route='/preview' transition-on='glide'><${Preview} /></app-view>
      <app-view name='settings' route='/settings' transition-on='glide'><${SettingsView} /></app-view>
      <${Dock} items=${dockItems} current=${current.value} />
    </app-root>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
