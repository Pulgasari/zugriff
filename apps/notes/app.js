// apps/notes/app.js

// :::::: IMPORT

// the frame is aufbau's: an <app-root> with the views in its main area, the
// folder tree in a menu area docked at the start (a sidebar when there is room,
// a drawer when there is not) and the settings in a config area at the end

import { gestalt }                     from '@aufbau/api';
import { computed, effect, typedSignal } from '@aufbau/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

import FolderLibrary  from '/.shared/js/modules/folders.js';
import { sharedSpec } from '/.shared/js/components/Settings.js';

const // shared components
Brand       = await zugriff.component('Brand'),
Dock        = await zugriff.component('Dock'),
Empty       = await zugriff.component('Empty'),
FolderTree  = await zugriff.component('FolderTree'),
InstallTip  = await zugriff.component('InstallTip'),
Reader      = await zugriff.component('Reader'),
SearchPanel = await zugriff.component('SearchPanel');


// :::::: APP

const app = zugriff.app;
app.lib = new FolderLibrary({ accept: 'md, markdown, mdown, mkd, mdwn, mdtxt' });

// ::: state

app.state.$extend({
  filter : { type: 'scalar', value: '' },
});

// durable state — hydrates from + persists to localStorage
const open = typedSignal({ type: 'scalar', value: null, key: 'notes:open', storage: 'local' });   // { sourceId, path } | null

// :::::: FRAME

const show = app.show;
const area = app.area;

// a drawer closes once something in it was picked, a sidebar stays
const closeMenu = () => { if (area('menu')?.isOverlay) area('menu').hide(); };

function openNote (sourceId, path) {
  open.value = { sourceId, path };
  show('note');
  closeMenu();
}

// :::::: ACTIONS

async function addFolder () {
  if (!zugriff.fs.supported()) { app.toast({ error: 'This browser can’t open folders — try Chrome, Edge or another Chromium browser.' }); return; }
  try {
    const record = await app.lib.addFolder();
    if (record) app.toast({ success: `Opened ${record.name}` });
  }
  catch (e) { app.toast(e); }
}

// :::::: TREE HELPERS

// derive a note's display title: the filename without its extension
const titleOf = node => node.name.replace(/\.[^.]+$/, '');

// :::::: MENU

function Menu () {
  return html`
    <div class='menu'>
      <${Brand} app=${app} />
      <${SearchPanel} placeholder='filter notes ...' appStateId='filter' />

      <${FolderTree}
        lib=${app.lib}
        filter=${app.state.$filter}
        selected=${open.value}
        onOpen=${openNote}
        onRemoveSource=${id => { if (open.value?.sourceId === id) { open.value = null; show('start'); } }}
        labelOf=${titleOf}
        fileIcon='notes'
        emptyText='No markdown files here'
        expandedKey='notes:expanded'
      />

      <div class='side-foot'>
        <${InstallTip} />
        <btn-push icon='folder-add' label='Open a folder' onClick=${addFolder} />
      </div>
    </div>
  `;
}

// :::::: CONFIG

// the shared fields (palette, skin, …), written into app.state
function Config () {
  const host = useRef(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let closed = false;

    gestalt.palettes().then(palettes => {
      if (closed) return;
      const spec = sharedSpec(app.config, palettes);
      element.values = Object.fromEntries(Object.keys(spec).map(key => [key, app.state['$' + key]]));
      element.spec   = spec;
    });

    const onConfig = event => { app.state[event.detail.key] = event.detail.values[event.detail.key]; };
    element.addEventListener('config', onConfig);

    // the form follows the state while it is open, a change from elsewhere included
    const keys   = Object.keys(sharedSpec(app.config, []));
    const follow = effect(() => {
      const values = Object.fromEntries(keys.map(key => [key, app.state['$' + key]]));
      if (element.spec && Object.keys(element.spec).length) element.values = values;
    });

    return () => { closed = true; follow(); element.removeEventListener('config', onConfig); };
  }, []);

  return html`
    <app-panel heading='Settings'>
      <app-config ref=${host}></app-config>
    </app-panel>
  `;
}

// :::::: VIEWS

// resolve the open note against the freshest scan
const currentNote = computed(() => {
  const o = open.value;
  if (!o) return null;
  const node = app.lib.nodeAt(o.sourceId, o.path);
  return node ? { sourceId: o.sourceId, node } : null;
});

function Header ({ segments = [] }) {
  return html`
    <header>
      <btn-icon icon='menu' title='notes' onClick=${() => area('menu')?.toggle()} />
      <nav-crumbs path=${segments.join('/')}></nav-crumbs>
      <btn-icon icon='settings' title='settings' onClick=${() => area('config')?.toggle()} />
    </header>
  `;
}

// no note open: open a folder, or pick a note from the tree
function Start () {
  const hasSources = app.lib.sources.value.length > 0;
  const action     = hasSources ? '' : html`<btn-push label='Open a folder' icon='folder-add' onClick=${addFolder} />`;
  const hint       = hasSources ? 'Choose a note to start reading.' : 'Open a folder of Markdown files to get started.';

  return html`
    <div class='reader'>
      <${Header} />
      <${Empty} icon='notes' title='No note open' hint=${hint} action=${action} />
    </div>
  `;
}

// the open note: read its text off disk and hand it to the shared <${Reader}>,
// which owns the markdown pipeline; <nav-toc> builds the "on this page" list
// off the rendered headings
function NoteText ({ note }) {
  const [text, setText] = useState(null);

  useEffect(() => {
    let alive = true;
    setText(null);
    app.lib.readText(note.node)
      .then(text => { if (alive) setText(text); })
      .catch(err => { app.toast({ error: 'Could not read that note: ' + err.message }); if (alive) setText(''); });
    return () => { alive = false; };
  }, [note.sourceId, note.node.path, note.node.handle]);

  return (text == null)
  ? html`<div class='booting'><svg-icon icon='loading'></svg-icon></div>`
  : html`<>
    <${Reader} id='notes-reader' format='markdown' text=${text} />
    <nav-toc target='#notes-reader' selector='h1, h2, h3'></nav-toc>
  </>`;
}

function Note () {
  const note = currentNote.value;
  if (!note) return html`<${Start} />`;

  return html`
    <div class='reader'>
      <${Header} segments=${note.node.path.split('/')} />
      <${NoteText} note=${note} />
    </div>
  `;
}

// :::::: ROOT

const current = { value: open.value ? 'note' : 'start' };

const dockItems = [
  { icon: 'menu',     label: 'notes',    onClick: () => area('menu')?.toggle()   },
  { icon: 'settings', label: 'settings', onClick: () => area('config')?.toggle() },
];

// the areas of #app, the root
function App () {
  useEffect(() => { app.lib.load().catch(app.toast); }, []);

  // the tree is the way through the notes: a sidebar from the start where there is
  // room. the elements are defined by the autoloader, so this waits for them
  useEffect(() => {
    if (!app.lib.ready.value) return;
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      const menu = area('menu');
      if (menu && !menu.isOverlay) menu.show();
    });
  }, [app.lib.ready.value]);

  if (!app.lib.ready.value) return html`<div class='booting'><svg-icon icon='loading'></svg-icon></div>`;

  return html`
    <app-area name='main'>
      <app-view name='start' route='/' active=${current.value === 'start' || undefined}><${Start} /></app-view>
      <app-view name='note' route='/note' transition-on='glide' active=${current.value === 'note' || undefined}><${Note} /></app-view>
      <${Dock} items=${dockItems} />
    </app-area>
    <app-area name='menu' dock='start'><${Menu} /></app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
