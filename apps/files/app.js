// apps/files/app.js
// a file manager over one granted folder. the frame is aufbau's: an app-root
// with areas, the views in the main one. the runtime binds zugriff (+
// zugriff.app, html) to window before this runs, so nothing here imports it.
//
// areas:
//   main     the views: dashboard (route /), library (/library), preview (/preview)
//   menu     start, the app's menu
//   config   end, the settings
//   context  bottom, what belongs to the current folder, file or view
//
// the library has tabs: several folders open side by side, each with its own
// path. tabs and the search field sit at the bottom by default, the settings
// move either to the top.

// :::::: IMPORT ::::::::::::::::::::::::::::::::::::::::::::::

import { autoloader }               from '@aufbau/components';
import { computed, effect, signal } from '@aufbau/signals';
import { gestalt }                  from '@aufbau/api';
import { patternStyle }             from '@aufbau/components/input/pattern.js';

import { useEffect, useRef, useState } from 'preact/hooks';

import Icon               from '/.shared/js/components/Icon.js';
import { sharedSpec }     from '/.shared/js/components/Settings.js';
import fmt                from '/.shared/js/modules/fmt.js';
import { createThumbCache } from '/.shared/js/thumbs.js';

// app-*, div-*, input-* and the rest of the components. the elements come with aufbau.boot()
autoloader({ elements: false });

// :::::: HANDLE ::::::::::::::::::::::::::::::::::::::::::::::

const app = zugriff.app;
const fs  = zugriff.fs;

app.db   = await app.module('db');
app.scan     = await app.module('scan');
app.tasks    = await app.module('tasks');
app.places   = await app.module('places');
app.transfer = await app.module('transfer');
app.remotes  = await app.module('remotes');

app.remotes.load().catch(err => console.warn('[files] remotes failed to load', err));

const { CATEGORIES, categoryOf } = app.scan;

// the patterns are input-pattern values: 'dots 8%', '' for none
app.state.$extend({
  'pattern-bg'   : { type: String,   value: '' },
  'pattern-tile' : { type: String,   value: '' },
  open           : { type: 'enum',   value: 'auto',   values: ['auto', 'double', 'single'] },
  searchbar      : { type: 'enum',   value: 'bottom', values: ['bottom', 'top'] },
  tab            : { type: Number,   value: 0 },
  tabbar         : { type: 'enum',   value: 'bottom', values: ['bottom', 'top'] },
  tabs           : { type: 'scalar', value: [{ path: [] }] },
  viewmode       : { type: 'enum',   value: 'list',   values: ['grid', 'list'] },
});

// one cache for the whole app, in opfs. the images of a folder, small
const thumbs = createThumbCache({ name: 'zugriff/files-thumbs', width: 256, maxBytes: 128 * 1024 * 1024, scope: 'files:thumbs' });

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::::

const entries  = signal([]);       // the listing of the current tab's path
const loading  = signal(false);    // a listing is on its way, the old one is gone already
const filter   = signal('');       // the library's live filter
const query    = signal('');       // the dashboard's search over the index
const category = signal(null);     // the category the dashboard lists, or null
const selected = signal(null);     // the entry the context area is about
const file     = signal(null);     // the entry in the preview
const current  = signal('dashboard');
const sheet    = signal(null);      // what the context area shows instead: 'tasks', 'remotes'

const rootRef = { current: null };
const show    = name => rootRef.current?.show(name);
const area    = name => rootRef.current?.area(name);

const touch      = () => globalThis.matchMedia?.('(pointer: coarse)').matches;
const opensOnTap = () => app.state.$open === 'single' || (app.state.$open === 'auto' && touch());

// :::::: TABS ::::::::::::::::::::::::::::::::::::::::::::::::

// a tab is { path, source }: source null is the granted folder, else a remote's id
const tabs      = () => app.state.$tabs?.length ? app.state.$tabs : [{ path: [] }];
const tabIndex  = () => Math.min(Math.max(0, app.state.$tab), tabs().length - 1);
const path      = computed(() => tabs()[tabIndex()].path);
const source    = computed(() => tabs()[tabIndex()].source ?? null);
const scrollTop = new Map;   // per tab, for the session

function setTabs (next, index = tabIndex()) {
  app.state.tabs = next;
  app.state.tab  = Math.min(Math.max(0, index), next.length - 1);
}

// `from` switches the tab to another source, undefined keeps its own
function goTo (next, from) {
  setTabs(tabs().map((tab, index) => index === tabIndex() ? { path: next, source: from === undefined ? tab.source ?? null : from } : tab));
  selected.value = null;
  filter.value   = '';
}

function openTab (at = path.value, from = source.value) {
  const next = [...tabs(), { path: at, source: from }];
  setTabs(next, next.length - 1);
  selected.value = null;
}

function closeTab (index) {
  const list = tabs();
  if (list.length === 1) return goTo([]);
  setTabs(list.filter((_, position) => position !== index), index < tabIndex() ? tabIndex() - 1 : tabIndex());
}

function switchTab (index) {
  scrollTop.set(tabIndex(), libraryScroller()?.scrollTop ?? 0);
  setTabs(tabs(), index);
  selected.value = null;
}

const libraryScroller = () => document.querySelector('app-view[name="library"] .listing');

// :::::: FILES :::::::::::::::::::::::::::::::::::::::::::::::

// the granted folder, and the root of a source: null for the folder, a remote's id
const localRoot    = () => app.db.perm.value === 'granted' ? app.db.folder.value?.handle ?? null : null;
const rootOfSource = from => from ? app.remotes.rootOf(from) : localRoot();
const sourceName   = from => from ? app.remotes.byId(from)?.name ?? 'remote' : app.db.folder.value?.name ?? 'folder';

// the root of the tab on screen
const rootHandle = () => rootOfSource(source.value);
const folderName = () => sourceName(source.value);

// an entry of the index (it carries its path) is in the folder, one of a listing in the tab's source
const sourceOf = entry => entry.path ? null : source.value;

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
    .then (list => {
      if (own !== request) return;
      entries.value = list;
      requestAnimationFrame(() => { const scroller = libraryScroller(); if (scroller) scroller.scrollTop = scrollTop.get(tabIndex()) ?? 0; });
    })
    .catch(err  => { if (own === request) app.toast.error(err); })
    .finally(()  => { if (own === request) loading.value = false; });
});

// the index of the whole folder: the stored one at once, a fresh walk behind it
let scanned = null;
effect(() => {
  const root   = localRoot();
  const folder = app.db.folder.value;
  if (!root || !folder || scanned === folder) return;
  scanned = folder;
  app.scan.restore(folder).then(() => indexFolder(root, folder));
});

// the walk as a task: its file count is the progress, cancelling stops it
function indexFolder (root, folder) {
  return app.tasks.run({ icon: 'lucide:scan-search', label: `Read ${folder.name}`, lane: 'index' }, ({ progress, signal }) => {
    signal.addEventListener('abort', () => app.scan.stop());
    const follow = effect(() => { const scanning = app.scan.scanning.value; if (scanning) progress(scanning.files, null); });
    return app.scan.scan(root, folder).finally(follow);
  }).catch(err => console.warn('[files] scan failed', err));
}

const rescan = () => { const root = localRoot(); if (root) indexFolder(root, app.db.folder.value); };

function open (entry, at = path.value) {
  if (entry.kind === 'directory') { goTo([...at, entry.name]); return show('library'); }
  file.value = { ...entry, kind: 'file', path: entry.path ?? at, source: entry.source ?? sourceOf(entry) };
  show('preview');
}

function showInFolder (entry) {
  goTo(entry.path ?? [], entry.source ?? sourceOf(entry));
  show('library');
}

// a tap opens, or a click picks and a double click opens, see opensOnTap()
function onEntryClick (entry) {
  if (opensOnTap()) return open(entry);
  selected.value = entry;
}

function about (entry) {
  selected.value = entry;
  area('context')?.show();
}

const visible = () => {
  const needle = filter.value.trim().toLowerCase();
  return needle ? entries.value.filter(entry => entry.name.toLowerCase().includes(needle)) : entries.value;
};

// a folder with a type shows the type's icon, `at` is the path the entry lies in
const iconOf = (entry, at) =>
    entry.kind === 'directory' ? (at && app.places.typeOf([...at, entry.name])?.icon) || 'lucide:folder'
  : CATEGORIES.find(item => item.id === categoryOf(entry))?.icon ?? 'lucide:file';

const isImage = entry => entry.kind !== 'directory' && entry.type?.startsWith('image/');

// :::::: WRITE ::::::::::::::::::::::::::::::::::::::::::::::::
// the folder is granted read only. a write asks for more on the click that wants
// it, then runs as a task in the write lane: the app stays usable meanwhile, and
// two writes never run into each other

async function writable () {
  const root = rootHandle();
  if (!root) return null;
  const { granted } = await fs.requestRead(root, 'readwrite');
  if (!granted) { app.toast.error('No permission to change this folder'); return null; }
  return root;
}

async function newFolder () {
  const name = prompt('Name of the new folder');
  if (!name) return;
  const root = await writable();
  if (!root) return;
  write({ icon: 'lucide:folder-plus', label: `New folder ${name}` }, path.value, () => fs.mkdir(root, path.value, name));
}

async function renameEntry (entry) {
  const name = prompt('New name', entry.name);
  if (!name || name === entry.name) return;
  const root = await writable();
  if (!root) return;
  const at = entry.path ?? path.value;
  selected.value = null;
  write({ icon: 'lucide:pencil', label: `Rename ${entry.name} to ${name}` }, at, () => fs.rename(root, at, entry.name, name, entry.kind));
}

async function deleteEntry (entry) {
  if (!confirm(`Delete “${entry.name}”? This removes it from your disk.`)) return;
  const root = await writable();
  if (!root) return;
  const at = entry.path ?? path.value;
  selected.value = null;
  area('context')?.hide();
  write({ icon: 'lucide:trash-2', label: `Delete ${entry.name}` }, at, () => fs.remove(root, at, entry.name));
}

// what the clipboard holds goes into the folder on screen, as one task
async function paste () {
  const board = app.transfer.clipboard.value;
  if (!board) return;
  const root = await writable();
  if (!root) return;

  const target = [...path.value];
  const count  = board.items.length;
  const what   = count === 1 ? board.items[0].name : `${count} items`;
  const verb   = board.mode === 'move' ? 'Move' : 'Copy';
  if (board.mode === 'move') app.transfer.clear();
  else app.transfer.pasted();

  const done = () => { if (target.join('/') === path.value.join('/')) goTo([...target]); };
  app.tasks.run({ icon: board.mode === 'move' ? 'lucide:scissors' : 'lucide:copy', label: `${verb} ${what} to /${target.join('/')}`, lane: 'write' },
    ({ progress, signal }) => app.transfer.transfer(root, board.items, board.mode, target, { onProgress: progress, signal }))
    .then(done)
    .catch(err => { if (err?.name !== 'AbortError') app.toast.error(err); done(); });
}

// a write as a task. once it is done, the folder it changed is listed anew if it is still the one on screen
function write (task, at, work) {
  const same = () => at.join('/') === path.value.join('/');
  app.tasks.run({ ...task, lane: 'write' }, work)
    .then(() => { if (same()) goTo([...at]); })
    .catch(err => app.toast.error(err));
}

async function download (entry) {
  const blob = await fs.readFile(rootOfSource(entry.source ?? sourceOf(entry)), entry.path ?? path.value, entry.name);
  const link = Object.assign(document.createElement('a'), { download: entry.name, href: URL.createObjectURL(blob) });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// :::::: FOLDER ::::::::::::::::::::::::::::::::::::::::::::::

async function chooseFolder () {
  if (!fs.supported()) return;
  try         { await app.db.grant(); setTabs([{ path: [] }], 0); show('dashboard'); }
  catch (err) { console.warn('[files] grant failed', err); }
}

async function reconnect () {
  const result = await app.db.reconnect();
  if (!result.granted) return chooseFolder();
}

async function closeFolder () {
  if (!confirm('Close this folder? Your files are untouched, only the app forgets it.')) return;
  await app.scan.forget(app.db.folder.value);
  scanned = null;
  await app.db.forget();
  setTabs([{ path: [] }], 0);
}

// :::::: PARTS :::::::::::::::::::::::::::::::::::::::::::::::

function IconButton ({ icon, label, onClick, pressed, disabled }) {
  return html`
    <button class='icon-button' type='button' aria-label=${label} title=${label}
            aria-pressed=${pressed == null ? null : String(pressed)} disabled=${disabled} onClick=${onClick}>
      <${Icon} name=${icon} />
    </button>
  `;
}

function Bar ({ title, back, children }) {
  return html`
    <header class='bar'>
      ${back
        ? html`<${IconButton} icon='lucide:arrow-left' label='back' onClick=${back} />`
        : html`<${IconButton} icon='lucide:menu' label='menu' onClick=${() => area('menu')?.toggle()} />`}
      <h1>${title}</h1>
      ${children}
      <${IconButton} icon='lucide:settings' label='settings' onClick=${() => area('config')?.toggle()} />
    </header>
  `;
}

function Hero ({ icon, title, children }) {
  return html`
    <div-y class='hero'>
      <${Icon} name=${icon} />
      <h2>${title}</h2>
      ${children}
    </div-y>
  `;
}

// the thumbnail of an image once it is on screen, the icon of its kind until then
// `from` is the entry's source, null for the granted folder
function Thumb ({ entry, at, from = null }) {
  const holder = useRef(null);
  const id     = isImage(entry) ? `${from ?? app.db.folder.value?.addedAt}/${at.join('/')}/${entry.name}:${entry.size}:${entry.lastModified}` : null;
  const [url, setUrl] = useState(() => thumbs.peekFile(id));

  useEffect(() => {
    setUrl(thumbs.peekFile(id));
    if (!id || thumbs.peekFile(id) || !holder.current) return;

    let alive = true;
    const observer = new IntersectionObserver(([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      thumbs.requestFile(id, () => fs.readFile(rootOfSource(from), at, entry.name)).then(made => { if (alive && made) setUrl(made); });
    }, { rootMargin: '200px' });

    observer.observe(holder.current);
    return () => { alive = false; observer.disconnect(); };
  }, [id]);

  return html`
    <span class='thumb' ref=${holder}>
      ${url ? html`<img src=${url} alt='' loading='lazy' />` : html`<${Icon} name=${iconOf(entry, from ? null : at)} />`}
    </span>
  `;
}

function Status () {
  const scanning = app.scan.scanning.value;
  const index    = app.scan.index.value;
  if (scanning) return html`<p class='status'><${Icon} name='loading' /> Reading the folder … ${scanning.files} files</p>`;
  if (index)    return html`<p class='status'>${index.total} files · ${fmt.bytes(index.size)} · read ${fmt.date(index.scannedAt)}</p>`;
  return null;
}

// :::::: DASHBOARD :::::::::::::::::::::::::::::::::::::::::::

function Search () {
  return html`
    <div class='searchbar'>
      <input-search placeholder=${`Search in ${folderName()}`} onsearch=${event => { query.value = event.detail.query; }}></input-search>
      <${TasksButton} />
    </div>
  `;
}

function FileRow ({ entry }) {
  return html`
    <li class='row'>
      <button class='entry' type='button' onClick=${() => open(entry)}>
        <${Thumb} entry=${entry} at=${entry.path} />
        <span class='text'>
          <span class='name'>${entry.name}</span>
          <small>${['/' + entry.path.join('/'), fmt.bytes(entry.size)].join(' · ')}</small>
        </span>
      </button>
      <${IconButton} icon='lucide:ellipsis-vertical' label='more' onClick=${() => about({ ...entry, kind: 'file' })} />
    </li>
  `;
}

// by name, other always last
const SORTED = [...CATEGORIES].sort((a, b) =>
    a.id === 'other' ? 1
  : b.id === 'other' ? -1
  : a.label.localeCompare(b.label));

function Categories () {
  const index = app.scan.index.value;
  return html`
    <section>
      <h2>Categories</h2>
      <ul class='tiles'>
        ${SORTED.map(({ id, label, icon }) => {
          const stats = index?.categories?.[id];
          return html`
            <li key=${id}>
              <button class='tile' type='button' disabled=${!stats?.count} onClick=${() => { category.value = id; }}>
                <${Icon} name=${icon} />
                <span class='text'>
                  <span class='name'>${label}</span>
                  <small>${stats ? `${stats.count} · ${fmt.bytes(stats.size)}` : '…'}</small>
                </span>
              </button>
            </li>
          `;
        })}
      </ul>
    </section>
  `;
}

function Recent () {
  const recent = app.scan.index.value?.recent ?? [];
  if (!recent.length) return null;

  return html`
    <section>
      <h2>Recent</h2>
      <div-x class='cards' scrollable>
        ${recent.map(entry => html`
          <button class='card' type='button' key=${entry.path.join('/') + '/' + entry.name} onClick=${() => open(entry)}>
            <${Thumb} entry=${entry} at=${entry.path} />
            <span class='name'>${entry.name}</span>
            <small>${fmt.date(entry.lastModified)}</small>
          </button>
        `)}
      </div-x>
    </section>
  `;
}

function Places () {
  return html`
    <section>
      <h2>Folder</h2>
      <ul class='tiles'>
        <li>
          <button class='tile' type='button' onClick=${() => { goTo([]); show('library'); }}>
            <${Icon} name='lucide:folder-open' />
            <span class='text'>
              <span class='name'>${folderName()}</span>
              <small>${app.scan.index.value ? fmt.bytes(app.scan.index.value.size) : 'the granted folder'}</small>
            </span>
          </button>
        </li>
      </ul>
      <${Status} />
    </section>
  `;
}

function Bookmarks () {
  const list = app.places.bookmarks();
  return html`
    <section>
      <h2>Bookmarks</h2>
      ${list.length
        ? html`
          <ul class='tiles'>
            ${list.map(bookmark => html`
              <li key=${bookmark.path.join('/')}>
                <button class='tile' type='button' onClick=${() => { goTo(bookmark.path); show('library'); }}>
                  <${Icon} name=${app.places.typeOf(bookmark.path)?.icon ?? 'lucide:bookmark'} />
                  <span class='text'>
                    <span class='name'>${bookmark.name}</span>
                    <small>/${bookmark.path.join('/')}</small>
                  </span>
                </button>
              </li>
            `)}
          </ul>`
        : html`<p class='hint'>Folders you bookmark show up here, from their details below.</p>`}
    </section>
  `;
}

// places outside the granted folder. webdav works (nextcloud speaks it too), the
// rest are tiles that say what each would need
const PLANNED = [
  { icon: 'lucide:hard-drive', label: 'Google Drive', note: 'its own api, sign in with oauth' },
  { icon: 'lucide:terminal',   label: '(S)FTP',       note: 'not from a browser, only in the android app' },
  { icon: 'lucide:network',    label: 'LAN',          note: 'smb shares, only in the android app' },
];

// a remote opens in a tab of its own
function openRemote (id) {
  openTab([], id);
  show('library');
}

function manageRemotes () {
  selected.value = null;
  sheet.value    = 'remotes';
  area('context')?.show();
}

function Remotes () {
  const connections = app.remotes.connections.value;

  return html`
    <section>
      <h2>Remote</h2>
      <ul class='tiles'>
        ${connections.map(connection => html`
          <li key=${connection.id}>
            <button class='tile' type='button' onClick=${() => openRemote(connection.id)}>
              <${Icon} name='lucide:cloud' />
              <span class='text'>
                <span class='name'>${connection.name}</span>
                <small>${new URL(connection.url).host}</small>
              </span>
            </button>
          </li>
        `)}
        <li>
          <button class='tile' type='button' onClick=${manageRemotes}>
            <${Icon} name='lucide:cloud-cog' />
            <span class='text'>
              <span class='name'>WebDAV, Nextcloud</span>
              <small>${connections.length ? 'add or remove' : 'connect a server'}</small>
            </span>
          </button>
        </li>
        ${PLANNED.map(remote => html`
          <li key=${remote.label}>
            <button class='tile' type='button' disabled title=${remote.note}>
              <${Icon} name=${remote.icon} />
              <span class='text'>
                <span class='name'>${remote.label}</span>
                <small>soon · ${remote.note}</small>
              </span>
            </button>
          </li>
        `)}
      </ul>
    </section>
  `;
}

// the connections, and a form for one more. adding tests it with a listing first
const remoteError = signal(null);
const remoteBusy  = signal(false);

function RemoteManager () {
  const form = useRef(null);

  const add = async event => {
    event.preventDefault();
    const field = name => form.current.querySelector(`[name="${name}"]`)?.value ?? '';
    remoteBusy.value  = true;
    remoteError.value = null;
    try {
      const connection = await app.remotes.add({ name: field('name'), password: field('password'), url: field('url'), username: field('username') });
      form.current.reset?.();
      openRemote(connection.id);
      area('context')?.hide();
    }
    catch (err) { remoteError.value = err.message ?? String(err); }
    finally     { remoteBusy.value = false; }
  };

  const remove = connection => {
    if (!confirm(`Forget “${connection.name}”? The files on the server stay.`)) return;
    app.remotes.remove(connection.id);
    // its tabs close with it, the last one falls back to the folder
    const left = tabs().filter(tab => tab.source !== connection.id);
    setTabs(left.length ? left : [{ path: [] }], 0);
  };

  return html`
    ${app.remotes.connections.value.length > 0 && html`
      <ul class='tasks'>
        ${app.remotes.connections.value.map(connection => html`
          <li class='task' key=${connection.id}>
            <${Icon} name='lucide:cloud' />
            <span class='text'><span class='name'>${connection.name}</span><small>${connection.url}</small></span>
            <${IconButton} icon='lucide:trash-2' label=${`forget ${connection.name}`} onClick=${() => remove(connection)} />
          </li>
        `)}
      </ul>`}
    <h3>Connect</h3>
    <form class='remote-form' ref=${form} onSubmit=${add}>
      <aufbau-input name='url' type='url' placeholder='https://cloud.example/remote.php/dav/files/me/' required></aufbau-input>
      <aufbau-input name='username' type='text' placeholder='username' autocomplete='username'></aufbau-input>
      <aufbau-input name='password' type='password' placeholder='password or app password' autocomplete='current-password'></aufbau-input>
      <aufbau-input name='name' type='text' placeholder='name (optional)'></aufbau-input>
      ${remoteError.value && html`<p class='error'>${remoteError.value}</p>`}
      <button class='action' type='submit' disabled=${remoteBusy.value}><${Icon} name=${remoteBusy.value ? 'loading' : 'lucide:plug'} /> connect</button>
    </form>
    <p class='hint'>The server has to allow this app (cors). Nextcloud: the url ends in /remote.php/dav/files/${'<user>'}/, best with an app password. The password stays on this device.</p>
  `;
}

function CategoryList () {
  const id    = category.value;
  const label = CATEGORIES.find(item => item.id === id)?.label ?? id;
  const files = (app.scan.index.value?.files ?? []).filter(entry => categoryOf(entry) === id)
    .sort((a, b) => b.lastModified - a.lastModified).slice(0, 500);

  return html`
    <section>
      <div-x class='section-head'>
        <${IconButton} icon='lucide:arrow-left' label='back' onClick=${() => { category.value = null; }} />
        <h2>${label}</h2>
      </div-x>
      <ul class='rows'>${files.map(entry => html`<${FileRow} key=${entry.path.join('/') + '/' + entry.name} entry=${entry} />`)}</ul>
    </section>
  `;
}

function Results () {
  const hits = app.scan.search(query.value);
  return html`
    <section>
      <h2>${hits.length ? `Found ${hits.length >= 100 ? '100+' : hits.length}` : 'Nothing found'}</h2>
      <ul class='rows'>${hits.map(entry => html`<${FileRow} key=${entry.path.join('/') + '/' + entry.name} entry=${entry} />`)}</ul>
    </section>
  `;
}

function Welcome () {
  if (!fs.supported()) return html`
    <${Hero} icon='alert' title="Can't open folders here">
      <p>This browser has no File System Access API. Try a recent Chromium based browser.</p>
    </${Hero}>
  `;

  if (!app.db.ready.value) return html`<${Icon} name='loading' />`;

  if (!app.db.folder.value) return html`
    <${Hero} icon='folder-open' title='Browse a folder'>
      <p>Pick a folder of your device, it becomes the root. Nothing is uploaded or copied.</p>
      <button class='action' type='button' onClick=${chooseFolder}><${Icon} name='folder-add' /> Open a folder</button>
    </${Hero}>
  `;

  return html`
    <${Hero} icon='folder-key' title=${`Reconnect “${folderName()}”`}>
      <p>This folder needs permission again for this visit.</p>
      <button class='action' type='button' onClick=${reconnect}><${Icon} name='folder-key' /> Reconnect</button>
    </${Hero}>
  `;
}

function Dashboard () {
  const ready  = Boolean(localRoot());
  const search = ready && html`<${Search} />`;
  const top    = app.state.$searchbar === 'top';

  return html`
    <${Bar} title='Files' />
    ${top && search}
    <div class='scroll'>
      ${!ready ? html`<${Welcome} />`
      : query.value.trim() ? html`<${Results} />`
      : category.value ? html`<${CategoryList} />`
      : html`<${Recent} /><${Bookmarks} /><${Categories} /><${Places} /><${Remotes} />`}
    </div>
    ${!top && search}
  `;
}

// :::::: LIBRARY :::::::::::::::::::::::::::::::::::::::::::::

function Entry ({ entry }) {
  const isSelected = selected.value?.name === entry.name && !selected.value?.path;
  return html`
    <aufbau-item>
      <div class=${isSelected ? 'row selected' : 'row'}>
        <button class='entry' type='button'
                aria-pressed=${isSelected ? 'true' : null}
                onClick=${() => onEntryClick(entry)}
                onDblClick=${() => open(entry)}
                onKeyDown=${event => event.key === 'Enter' && !opensOnTap() && (event.preventDefault(), open(entry))}>
          <${Thumb} entry=${entry} at=${path.value} from=${source.value} />
          <span class='text'>
            <span class='name'>${entry.name}</span>
            <small>${entry.kind === 'file' ? `${fmt.date(entry.lastModified)} · ${fmt.bytes(entry.size)}` : 'folder'}</small>
          </span>
        </button>
        <${IconButton} icon='lucide:ellipsis-vertical' label='more' onClick=${() => about(entry)} />
      </div>
    </aufbau-item>
  `;
}

function Tabs () {
  const list = tabs();
  const name = tab => tab.path.at(-1) ?? sourceName(tab.source ?? null);

  return html`
    <div-x class='tabs' role='tablist' scrollable>
      ${list.map((tab, index) => html`
        <div class=${index === tabIndex() ? 'tab active' : 'tab'} key=${index}>
          <button type='button' role='tab' aria-selected=${String(index === tabIndex())} onClick=${() => switchTab(index)}>${name(tab)}</button>
          ${list.length > 1 && html`<${IconButton} icon='lucide:x' label=${`close ${name(tab)}`} onClick=${() => closeTab(index)} />`}
        </div>
      `)}
      <${IconButton} icon='lucide:plus' label='new tab' onClick=${() => openTab()} />
    </div-x>
  `;
}

function Filter () {
  return html`
    <div class='searchbar'>
      <input-search placeholder='Filter this folder' value=${filter.value} onsearch=${event => { filter.value = event.detail.query; }}></input-search>
      <${TasksButton} />
    </div>
  `;
}

function Crumbs () {
  const crumbs = useRef(null);

  // the crumbs speak an event of their own, preact knows only standard ones
  useEffect(() => {
    const element = crumbs.current;
    const onCrumb = event => goTo(event.detail.path.split('/').filter(Boolean));
    element?.addEventListener('aufbau-crumbs', onCrumb);
    return () => element?.removeEventListener('aufbau-crumbs', onCrumb);
  }, []);

  return html`<aufbau-crumbs ref=${crumbs} root=${folderName()} path=${'/' + path.value.join('/')}></aufbau-crumbs>`;
}

function Library () {
  if (!rootHandle()) return html`<${Bar} title='Library' /><div class='scroll'><${Welcome} /></div>`;

  const up       = () => path.value.length ? goTo(path.value.slice(0, -1)) : show('dashboard');
  const list     = visible();
  const viewmode = app.state.$viewmode;
  const bars     = { search: html`<${Filter} />`, tabs: html`<${Tabs} />` };
  // the tabs are always the outermost bar, the search field sits between them and the listing
  const top      = [app.state.$tabbar === 'top' && bars.tabs, app.state.$searchbar === 'top' && bars.search];
  const bottom   = [app.state.$searchbar === 'bottom' && bars.search, app.state.$tabbar === 'bottom' && bars.tabs];

  return html`
    <${Bar} title=${path.value.at(-1) ?? folderName()} back=${up}>
      <${IconButton} icon=${viewmode === 'grid' ? 'lucide:list' : 'lucide:layout-grid'}
                     label=${viewmode === 'grid' ? 'show as list' : 'show as grid'}
                     onClick=${() => { app.state.viewmode = viewmode === 'grid' ? 'list' : 'grid'; }} />
    </${Bar}>
    ${top}
    <${Crumbs} />
    <div class='pane'>
      <div class='listing'>
        ${loading.value ? html`<${Icon} name='loading' />`
        : list.length
          ? html`<aufbau-index viewmode=${viewmode} item-size='8rem'>${list.map(entry => html`<${Entry} key=${entry.name} entry=${entry} />`)}</aufbau-index>`
          : html`<p class='empty'>${filter.value ? 'nothing matches the filter' : 'this folder is empty'}</p>`}
      </div>
      <app-float anchor='bottom-end'>
        <button class='fab' type='button' aria-label='new folder' title='new folder' onClick=${newFolder}><${Icon} name='lucide:folder-plus' /></button>
      </app-float>
    </div>
    <${PasteBar} />
    ${bottom}
  `;
}

// what waits on the clipboard, and the button that puts it here
function PasteBar () {
  const board = app.transfer.clipboard.value;
  if (!board) return null;

  const count = board.items.length;
  const what  = count === 1 ? board.items[0].name : `${count} items`;

  return html`
    <div-x class='pastebar'>
      <${Icon} name=${board.mode === 'move' ? 'lucide:scissors' : 'lucide:copy'} />
      <span class='text'><span class='name'>${what}</span><small>${board.mode === 'move' ? 'to move' : 'to copy'}</small></span>
      <button class='action' type='button' onClick=${paste}><${Icon} name='lucide:clipboard-paste' /> here</button>
      <${IconButton} icon='lucide:x' label='empty the clipboard' onClick=${app.transfer.clear} />
    </div-x>
  `;
}

// :::::: PREVIEW :::::::::::::::::::::::::::::::::::::::::::::
// a sketch: an image inline, the rest as its icon. the details are in the context area

const imageSize = signal(null);

function Preview () {
  const entry = file.value;
  const image = useRef(null);

  useEffect(() => {
    imageSize.value = null;
    if (!entry || !isImage(entry)) return;
    let url = null;
    let cancelled = false;
    fs.readFile(rootOfSource(entry.source), entry.path, entry.name).then(blob => {
      if (cancelled || !image.current) return;
      url = URL.createObjectURL(blob);
      image.current.onload = () => { imageSize.value = { width: image.current.naturalWidth, height: image.current.naturalHeight }; };
      image.current.src = url;
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [entry]);

  if (!entry) return html`<${Bar} title='Preview' back=${() => history.back()} /><p class='empty'>no file open</p>`;

  return html`
    <${Bar} title=${entry.name} back=${() => history.back()}>
      <${IconButton} icon='lucide:info' label='details' onClick=${() => { selected.value = null; area('context')?.toggle(); }} />
    </${Bar}>
    <div class='stage'>
      ${isImage(entry) ? html`<img ref=${image} alt=${entry.name} />` : html`<${Icon} name=${iconOf(entry)} />`}
    </div>
  `;
}

// :::::: CONTEXT :::::::::::::::::::::::::::::::::::::::::::::
// the bottom area: about the selected entry, the open file, the folder or the scan

function Facts ({ rows }) {
  return html`<dl class='facts'>${rows.filter(([, value]) => value != null && value !== '').map(([key, value]) => html`<dt>${key}</dt><dd>${value}</dd>`)}</dl>`;
}

function Actions ({ children }) {
  return html`<div-x class='actions'>${children}</div-x>`;
}

function Action ({ icon, label, onClick, disabled }) {
  return html`<button class='action' type='button' disabled=${disabled} onClick=${onClick}><${Icon} name=${icon} /> ${label}</button>`;
}

function EntryContext ({ entry }) {
  const at = entry.path ?? path.value;
  return html`
    <${Facts} rows=${[
      ['name',     entry.name],
      ['kind',     entry.kind === 'directory' ? 'folder' : entry.type || 'file'],
      ['size',     entry.kind === 'file' ? fmt.bytes(entry.size) : null],
      ['modified', entry.lastModified ? fmt.date(entry.lastModified) : null],
      ['in',       '/' + at.join('/')],
    ]} />
    <${Actions}>
      <${Action} icon='lucide:arrow-up-right' label='open' onClick=${() => open(entry, at)} />
      ${entry.path && html`<${Action} icon='lucide:folder' label='show in folder' onClick=${() => showInFolder(entry)} />`}
      ${entry.kind === 'file' && html`<${Action} icon='lucide:download' label='download' onClick=${() => download(entry)} />`}
      ${entry.kind === 'directory' && !(entry.source ?? sourceOf(entry)) && html`<${BookmarkAction} path=${[...at, entry.name]} name=${entry.name} />`}
      <${Action} icon='lucide:copy' label='copy' onClick=${() => { app.transfer.pick('copy', entry, at, rootOfSource(entry.source ?? sourceOf(entry))); area('context')?.hide(); }} />
      <${Action} icon='lucide:scissors' label='move' onClick=${() => { app.transfer.pick('move', entry, at, rootOfSource(entry.source ?? sourceOf(entry))); area('context')?.hide(); }} />
      <${Action} icon='lucide:pencil' label='rename' onClick=${() => renameEntry(entry)} />
      <${Action} icon='lucide:trash-2' label='delete' onClick=${() => deleteEntry(entry)} />
    </${Actions}>
  `;
}

function BookmarkAction ({ path: at, name }) {
  const marked = app.places.isBookmarked(at);
  return html`<${Action} icon=${marked ? 'lucide:bookmark-minus' : 'lucide:bookmark-plus'} label=${marked ? 'remove bookmark' : 'bookmark'} onClick=${() => app.places.toggleBookmark(at, name)} />`;
}

// the type of the folder on screen: one of the known ones, none, or a new one
function FolderType () {
  const at        = path.value;
  const current   = app.places.typeOf(at);
  const suggested = !current && app.places.suggest(entries.value, categoryOf);

  const create = () => {
    const label = prompt('Name of the new folder type');
    if (!label) return;
    const icon = prompt('Its icon (an iconify id)', 'lucide:folder') || 'lucide:folder';
    app.places.setType(at, app.places.addType({ icon, label }));
  };

  return html`
    <h3>Type</h3>
    ${suggested && html`<p class='hint'>Looks like ${suggested.label}. <button class='link' type='button' onClick=${() => app.places.setType(at, suggested.id)}>Make it one</button></p>`}
    <${Actions}>
      ${app.places.types().map(type => html`
        <button class='action' type='button' key=${type.id} aria-pressed=${String(current?.id === type.id)}
                onClick=${() => app.places.setType(at, current?.id === type.id ? null : type.id)}>
          <${Icon} name=${type.icon} /> ${type.label}
        </button>
      `)}
      <${Action} icon='lucide:plus' label='new type' onClick=${create} />
    </${Actions}>
  `;
}

// what a folder is mostly made of: the first step towards folder types
function FolderContext () {
  const list    = entries.value;
  const files   = list.filter(entry => entry.kind === 'file');
  const folders = list.length - files.length;
  const counts  = {};
  for (const entry of files) counts[categoryOf(entry)] = (counts[categoryOf(entry)] ?? 0) + 1;
  const mostly  = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const kind    = mostly && mostly[1] / files.length >= 0.6 ? CATEGORIES.find(item => item.id === mostly[0])?.label : null;

  return html`
    <${Facts} rows=${[
      ['folder',   path.value.at(-1) ?? folderName()],
      ['contains', `${folders} folders, ${files.length} files`],
      ['size',     fmt.bytes(files.reduce((sum, entry) => sum + entry.size, 0))],
      ['mostly',   kind],
    ]} />
    <${Actions}>
      <${Action} icon='lucide:folder-plus' label='new folder' onClick=${newFolder} />
      ${path.value.length > 0 && !source.value && html`<${BookmarkAction} path=${path.value} name=${path.value.at(-1)} />`}
      <${Action} icon='lucide:text-cursor-input' label='rename by pattern' disabled />
    </${Actions}>
    ${path.value.length > 0 && !source.value && html`<${FolderType} />`}
  `;
}

function FileContext ({ entry }) {
  const size = imageSize.value;
  return html`
    <${Facts} rows=${[
      ['name',       entry.name],
      ['type',       entry.type || 'unknown'],
      ['size',       fmt.bytes(entry.size)],
      ['dimensions', size ? `${size.width} × ${size.height}` : null],
      ['modified',   fmt.date(entry.lastModified)],
      ['in',         '/' + entry.path.join('/')],
    ]} />
    <${Actions}>
      <${Action} icon='lucide:download' label='download' onClick=${() => download(entry)} />
      <${Action} icon='lucide:folder' label='show in folder' onClick=${() => showInFolder(entry)} />
    </${Actions}>
  `;
}

function Context () {
  const view = current.value;

  if (sheet.value === 'tasks')   return html`<app-panel heading='Tasks'><${TaskList} /></app-panel>`;
  if (sheet.value === 'remotes') return html`<app-panel heading='Remote'><${RemoteManager} /></app-panel>`;

  if (selected.value) return html`<app-panel heading=${selected.value.name}><${EntryContext} entry=${selected.value} /></app-panel>`;
  if (view === 'preview' && file.value) return html`<app-panel heading='Details'><${FileContext} entry=${file.value} /></app-panel>`;
  if (view === 'library' && rootHandle()) return html`<app-panel heading='This folder'><${FolderContext} /></app-panel>`;

  return html`
    <app-panel heading=${folderName()}>
      <${Status} />
      <${Actions}><${Action} icon='lucide:refresh-cw' label='read again' disabled=${!localRoot() || Boolean(app.scan.scanning.value)} onClick=${rescan} /></${Actions}>
    </app-panel>
  `;
}

// :::::: TASKS :::::::::::::::::::::::::::::::::::::::::::::::
// what runs, what waits, what ran. the button sits beside the search field and
// turns while a task runs, the list is in the context area

function openTasks () {
  selected.value  = null;
  sheet.value    = 'tasks';
  area('context')?.show();
}

function TasksButton () {
  const busy  = app.tasks.busy.value;
  const count = app.tasks.queue.value.length;
  const label = count ? `${count} tasks` : 'tasks';

  return html`
    <button class=${busy ? 'tasks-button busy' : 'tasks-button'} type='button' aria-label=${label} title=${label} onClick=${openTasks}>
      <${Icon} name=${busy ? 'lucide:loader' : 'lucide:list-checks'} />
      ${count > 0 && html`<span class='badge'>${count}</span>`}
    </button>
  `;
}

const STATES = { cancelled: 'cancelled', done: 'done', failed: 'failed', queued: 'waiting', running: 'running' };

function TaskRow ({ task }) {
  const { done, total } = task.progress ?? {};
  const open  = task.state === 'queued' || task.state === 'running';
  const state = task.state === 'running' && done != null ? (total ? `${Math.round(done / total * 100)}%` : `${done}`) : STATES[task.state];

  return html`
    <li class=${`task ${task.state}`}>
      <${Icon} name=${task.icon} />
      <span class='text'>
        <span class='name'>${task.label}</span>
        <small>${task.error ?? [state, task.endedAt && fmt.date(task.endedAt)].filter(Boolean).join(' · ')}</small>
        ${task.state === 'running' && total ? html`<progress max=${total} value=${done}></progress>` : null}
      </span>
      ${open && html`<${IconButton} icon='lucide:x' label=${`cancel ${task.label}`} onClick=${() => app.tasks.cancel(task.id)} />`}
    </li>
  `;
}

function TaskList () {
  const queue   = app.tasks.queue.value;
  const history = app.tasks.history.value;

  return html`
    ${queue.length
      ? html`<ul class='tasks'>${queue.map(task => html`<${TaskRow} key=${task.id} task=${task} />`)}</ul>`
      : html`<p class='empty'>nothing to do</p>`}
    ${history.length > 0 && html`
      <div-x class='section-head'><h3>History</h3><${IconButton} icon='lucide:trash' label='clear the history' onClick=${app.tasks.clearHistory} /></div-x>
      <ul class='tasks'>${history.map(task => html`<${TaskRow} key=${task.id} task=${task} />`)}</ul>`}
  `;
}

// :::::: MENU ::::::::::::::::::::::::::::::::::::::::::::::::

const MENU = [
  { name: 'dashboard', label: 'Dashboard', icon: 'lucide:layout-dashboard' },
  { name: 'library',   label: 'Library',   icon: 'lucide:folder'           },
];

// the tools the app had before, coming back one by one
const SOON = [
  { label: 'Image editor', icon: 'lucide:image' },
  { label: 'Text editor',  icon: 'lucide:file-pen' },
];

function Menu () {
  const go = name => { show(name); if (area('menu')?.isOverlay) area('menu').hide(); };

  return html`
    <app-panel heading='Files' controls='close'>
      <nav class='menu'>
        ${MENU.map(item => html`
          <button type='button' key=${item.name} aria-current=${current.value === item.name ? 'page' : null} onClick=${() => go(item.name)}>
            <${Icon} name=${item.icon} /> ${item.label}
          </button>
        `)}
        <hr />
        ${SOON.map(item => html`<button type='button' key=${item.label} disabled><${Icon} name=${item.icon} /> ${item.label} <small>soon</small></button>`)}
        <hr />
        <button type='button' onClick=${() => area('config')?.show()}><${Icon} name='lucide:settings' /> Settings</button>
      </nav>
    </app-panel>
  `;
}

// :::::: CONFIG ::::::::::::::::::::::::::::::::::::::::::::::

const FIELDS = {
  open           : { type: 'enum', label: 'Open with',  look: 'segments', values: [['auto', 'auto'], ['single', 'a tap'], ['double', 'a double click']], default: 'auto' },
  searchbar      : { type: 'enum', label: 'Search bar', look: 'segments', values: ['bottom', 'top'], default: 'bottom' },
  tabbar         : { type: 'enum', label: 'Tabs',       look: 'segments', values: ['bottom', 'top'], default: 'bottom' },

  // no colors: a pattern takes the color of the text where it lies, only its opacity is chosen
  'pattern-bg'   : { tag: 'input-pattern', attrs: { opacity: true }, label: 'Background', default: '' },
  'pattern-tile' : { tag: 'input-pattern', attrs: { opacity: true }, label: 'Tiles',      default: '' },
};

// how the shared fields render here: the long lists step through their
// entries as well, the direction is a switch of two
const CONTROLS = {
  density  : { attrs: { stepper: true } },
  dir      : { look: 'segments' },
  font     : { attrs: { stepper: true } },
  geometry : { attrs: { stepper: true } },
  palette  : { attrs: { stepper: true } },
  skin     : { attrs: { stepper: true } },
};

// the patterns as custom properties on the root, app.css paints them. a late
// answer for a value that changed in the meantime is dropped
// the setting's key names the custom properties too: --pattern-bg-image, --pattern-bg-opacity
const PATTERNS = ['pattern-bg', 'pattern-tile'];

function usePatterns (root) {
  useEffect(() => effect(() => {
    const element = root.current;
    if (!element) return;

    for (const name of PATTERNS) {
      const value = app.state['$' + name];
      element.toggleAttribute(`data-${name}`, Boolean(value));
      if (!value) continue;

      patternStyle(value, { name }).then(style => {
        if (!style || app.state['$' + name] !== value) return;
        for (const [property, css] of Object.entries(style)) element.style.setProperty(property, css);
      });
    }
  }), []);
}

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
      element.controls = CONTROLS;
      element.values   = Object.fromEntries(Object.keys(spec).map(key => [key, app.state['$' + key]]));
      element.spec     = spec;
    });

    const onConfig = event => { app.state[event.detail.key] = event.detail.values[event.detail.key]; };
    element.addEventListener('config', onConfig);

    // the form follows the state while it is open, a change from elsewhere included
    const keys   = Object.keys({ ...sharedSpec(app.config, []), ...FIELDS });
    const follow = effect(() => {
      const values = Object.fromEntries(keys.map(key => [key, app.state['$' + key]]));
      if (element.spec && Object.keys(element.spec).length) element.values = values;
    });

    return () => { closed = true; follow(); element.removeEventListener('config', onConfig); };
  }, []);

  const folder = app.db.folder.value;

  return html`
    <app-panel heading='Settings'>
      <app-config ref=${host}></app-config>
      <h3>Folder</h3>
      ${folder
        ? html`
          <p class='folder'><${Icon} name='folder-open' /> ${folder.name}</p>
          <${Actions}>
            <${Action} icon='mdi:folder-swap-outline' label='change' onClick=${chooseFolder} />
            <${Action} icon='close' label='close' onClick=${closeFolder} />
          </${Actions}>`
        : html`<${Action} icon='folder-add' label='Open a folder' onClick=${chooseFolder} />`}
    </app-panel>
  `;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  const root = useRef(null);
  usePatterns(root);

  useEffect(() => {
    rootRef.current = root.current;
    app.db.load().catch(err => console.warn('[files] load failed', err));
  }, []);

  return html`
    <app-root ref=${root} routing='hash' onnavigate=${event => { current.value = event.detail.to; selected.value = null; }}>
      <app-area name='main'>
        <app-view name='dashboard' route='/' active><${Dashboard} /></app-view>
        <app-view name='library' route='/library' transition-on='glide'><${Library} /></app-view>
        <app-view name='preview' route='/preview' transition-on='glide'><${Preview} /></app-view>
      </app-area>
      <app-area name='menu' dock='start'><${Menu} /></app-area>
      <app-area name='config' dock='end'><${Config} /></app-area>
      <app-area name='context' dock='bottom' peek ontoggle=${event => { if (!event.detail?.open) sheet.value = null; }}><${Context} /></app-area>
    </app-root>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
