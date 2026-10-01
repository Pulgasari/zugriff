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
app.scan = await app.module('scan');

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

const rootRef = { current: null };
const show    = name => rootRef.current?.show(name);
const area    = name => rootRef.current?.area(name);

const touch      = () => globalThis.matchMedia?.('(pointer: coarse)').matches;
const opensOnTap = () => app.state.$open === 'single' || (app.state.$open === 'auto' && touch());

// :::::: TABS ::::::::::::::::::::::::::::::::::::::::::::::::

const tabs      = () => app.state.$tabs?.length ? app.state.$tabs : [{ path: [] }];
const tabIndex  = () => Math.min(Math.max(0, app.state.$tab), tabs().length - 1);
const path      = computed(() => tabs()[tabIndex()].path);
const scrollTop = new Map;   // per tab, for the session

function setTabs (next, index = tabIndex()) {
  app.state.tabs = next;
  app.state.tab  = Math.min(Math.max(0, index), next.length - 1);
}

function goTo (next) {
  setTabs(tabs().map((tab, index) => index === tabIndex() ? { ...tab, path: next } : tab));
  selected.value = null;
  filter.value   = '';
}

function openTab (at = path.value) {
  const next = [...tabs(), { path: at }];
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

const rootHandle = () => app.db.perm.value === 'granted' ? app.db.folder.value?.handle ?? null : null;
const folderName = () => app.db.folder.value?.name ?? 'folder';

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
  const root   = rootHandle();
  const folder = app.db.folder.value;
  if (!root || !folder || scanned === folder) return;
  scanned = folder;
  app.scan.restore(folder).then(() => app.scan.scan(root, folder)).catch(err => console.warn('[files] scan failed', err));
});

const rescan = () => { const root = rootHandle(); if (root) app.scan.scan(root, app.db.folder.value); };

function open (entry, at = path.value) {
  if (entry.kind === 'directory') { goTo([...at, entry.name]); return show('library'); }
  file.value = { ...entry, kind: 'file', path: entry.path ?? at };
  show('preview');
}

function showInFolder (entry) {
  goTo(entry.path ?? []);
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

const iconOf = entry =>
    entry.kind === 'directory' ? 'lucide:folder'
  : CATEGORIES.find(item => item.id === categoryOf(entry))?.icon ?? 'lucide:file';

const isImage = entry => entry.kind !== 'directory' && entry.type?.startsWith('image/');

// :::::: WRITE ::::::::::::::::::::::::::::::::::::::::::::::::
// the folder is granted read only. a write asks for more on the click that wants it

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
  try   { await fs.mkdir(root, path.value, name); goTo([...path.value]); }
  catch (err) { app.toast.error(err); }
}

async function renameEntry (entry) {
  const name = prompt('New name', entry.name);
  if (!name || name === entry.name) return;
  const root = await writable();
  if (!root) return;
  try   { await fs.rename(root, entry.path ?? path.value, entry.name, name, entry.kind); selected.value = null; goTo([...path.value]); }
  catch (err) { app.toast.error(err); }
}

async function deleteEntry (entry) {
  if (!confirm(`Delete “${entry.name}”? This removes it from your disk.`)) return;
  const root = await writable();
  if (!root) return;
  try   { await fs.remove(root, entry.path ?? path.value, entry.name); selected.value = null; area('context')?.hide(); goTo([...path.value]); }
  catch (err) { app.toast.error(err); }
}

async function download (entry) {
  const blob = await fs.readFile(rootHandle(), entry.path ?? path.value, entry.name);
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
function Thumb ({ entry, at }) {
  const holder = useRef(null);
  const id     = isImage(entry) ? `${app.db.folder.value?.addedAt}/${at.join('/')}/${entry.name}:${entry.size}:${entry.lastModified}` : null;
  const [url, setUrl] = useState(() => thumbs.peekFile(id));

  useEffect(() => {
    setUrl(thumbs.peekFile(id));
    if (!id || thumbs.peekFile(id) || !holder.current) return;

    let alive = true;
    const observer = new IntersectionObserver(([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      thumbs.requestFile(id, () => fs.readFile(rootHandle(), at, entry.name)).then(made => { if (alive && made) setUrl(made); });
    }, { rootMargin: '200px' });

    observer.observe(holder.current);
    return () => { alive = false; observer.disconnect(); };
  }, [id]);

  return html`
    <span class='thumb' ref=${holder}>
      ${url ? html`<img src=${url} alt='' loading='lazy' />` : html`<${Icon} name=${iconOf(entry)} />`}
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
  const ready  = Boolean(rootHandle());
  const search = ready && html`<${Search} />`;
  const top    = app.state.$searchbar === 'top';

  return html`
    <${Bar} title='Files' />
    ${top && search}
    <div class='scroll'>
      ${!ready ? html`<${Welcome} />`
      : query.value.trim() ? html`<${Results} />`
      : category.value ? html`<${CategoryList} />`
      : html`<${Recent} /><${Categories} /><${Places} />`}
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
          <${Thumb} entry=${entry} at=${path.value} />
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
  const name = tab => tab.path.at(-1) ?? folderName();

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
    ${bottom}
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
    fs.readFile(rootHandle(), entry.path, entry.name).then(blob => {
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
      <${Action} icon='lucide:pencil' label='rename' onClick=${() => renameEntry(entry)} />
      <${Action} icon='lucide:trash-2' label='delete' onClick=${() => deleteEntry(entry)} />
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
      <${Action} icon='lucide:text-cursor-input' label='rename by pattern' disabled />
    </${Actions}>
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

  if (selected.value) return html`<app-panel heading=${selected.value.name}><${EntryContext} entry=${selected.value} /></app-panel>`;
  if (view === 'preview' && file.value) return html`<app-panel heading='Details'><${FileContext} entry=${file.value} /></app-panel>`;
  if (view === 'library' && rootHandle()) return html`<app-panel heading='This folder'><${FolderContext} /></app-panel>`;

  return html`
    <app-panel heading=${folderName()}>
      <${Status} />
      <${Actions}><${Action} icon='lucide:refresh-cw' label='read again' disabled=${!rootHandle() || Boolean(app.scan.scanning.value)} onClick=${rescan} /></${Actions}>
    </app-panel>
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
      <app-area name='context' dock='bottom' peek><${Context} /></app-area>
    </app-root>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
