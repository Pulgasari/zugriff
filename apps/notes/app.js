// apps/notes/app.js

// :::::: IMPORT

import { computed, signal, typedSignal } from '@aufbau/signals';
import { useEffect, useState }     from 'preact/hooks';

import FolderLibrary from '/.shared/js/modules/folders.js';

const // shared components
Brand       = await zugriff.component('Brand'),
Button      = await zugriff.component('Button'),
Breadcrumbs = await zugriff.component('Breadcrumbs'),
Dock        = await zugriff.component('Dock'),
Empty       = await zugriff.component('Empty'),
FolderTree  = await zugriff.component('FolderTree'),
Icon        = await zugriff.component('Icon'),
IconButton  = await zugriff.component('IconButton'),
InstallTip  = await zugriff.component('InstallTip'),
Reader      = await zugriff.component('Reader'),
SearchPanel = await zugriff.component('SearchPanel'),
TOC         = await zugriff.component('TOC');


// :::::: APP

const app = zugriff.app;
app.lib = new FolderLibrary({ accept: 'md, markdown, mdown, mkd, mdwn, mdtxt' });
const { fs } = zugriff;

// ::: state

app.state.filter    = '';
app.state.isNavOpen = false;

// durable state — hydrates from + persists to localStorage
const open = typedSignal({ type: 'scalar', value: null, key: 'notes:open', storage: 'local' });   // { sourceId, path } | null

const closeSidebar = () => app.state.isNavOpen = false;
const  openSidebar = () => app.state.isNavOpen = true;

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

// :::::: SIDEBAR

function Sidebar () {
  return html`
    <aside class=${'sidebar' + (app.state.isNavOpen ? ' open' : '')}>
      <${Brand} app=${app} />
      <${Button} icon='close' aria-label='close' onClick=${closeSidebar} />
      <${SearchPanel} placeholder='filter notes ...' appStateId='filter' />

      <${FolderTree}
        lib=${app.lib}
        filter=${app.state.filter}
        selected=${open.value}
        onOpen=${(sourceId, path) => { open.value = { sourceId, path }; closeSidebar(); }}
        onRemoveSource=${id => { if (open.value?.sourceId === id) open.value = null; }}
        labelOf=${titleOf}
        fileIcon='notes'
        emptyText='No markdown files here'
        expandedKey='notes:expanded'
      />

      <div class="side-foot">
        <${InstallTip} />
        <${Button} icon='folder-add' label='Open a folder' onClick=${addFolder} />
      </div>
    </aside>
  `;
}

// :::::: READER

// resolve the note the router points at, against the freshest scan
const currentNote = computed(() => {
  const o = open.value;
  if (!o) return null;
  const node = app.lib.nodeAt(o.sourceId, o.path);
  return node ? { sourceId: o.sourceId, node } : null;
});

// the open note: read its text off disk and hand it to the shared <${Reader}>,
// which owns the markdown pipeline (via <aufbau-reader>); <${TOC}> builds the
// "on this page" list off the rendered headings.
function NoteView ({ note }) {
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
  ? html`<div>…</div>`
  : html`<>
    <${Reader} id='notes-reader' format='markdown' text=${text} />
    <${TOC} target='#notes-reader' selector='h1, h2, h3' />
  </>`;
}



// :::::: APP

function EmptyReader () {
  let action, hint;
  const hasSources = app.lib.sources.value.length ? true : false;

  if (hasSources) {
    action = '';
    hint   = 'Choose a note to start reading.';
  } else {
    action = html`<${Button} label='Open a folder' icon='folder-add' onClick=${addFolder} />`;    
    hint   = 'Open a folder of Markdown files to get started.';
  }
  
  return html`<${Empty} icon='notes' title='No note open' hint=${hint} action=${action} />`;
}

function NotesReader () {
  const note = currentNote.value;
  const segments = note ? note.node.path.split('/') : [];
  
  return html`
    <div class='reader'>
      <header>
        <${IconButton} icon='menu' aria-label="Open notes" onClick=${openSidebar} />
        <${Breadcrumbs} segments=${segments} />
      </header>
  
      ${note ? html`<${NoteView} note=${note} />` : html`<${EmptyReader}/>`}
    </div>
  `;
}

const dockItems = [
  { icon: 'menu', label: 'menu', onClick: () => app.state.isNavOpen = !app.state.isNavOpen },
];

function App () {
  useEffect(() => { app.lib.load().catch(app.toast); }, []);

  return (!app.lib.ready.value)
  ? html`<div class="booting"><${Icon} name='loading' /></div>`
  : html`<>
    <${Sidebar} />
    <main id='app-main'>
      <${NotesReader}/>
    </main>
    <${Dock} items=${dockItems} />
  </>`;
}

// :::::: BOOT

app.init({ App });
