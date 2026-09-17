// apps/notes/app.js

// :::::: IMPORT

import { computed, local, signal } from '@aufbau/signals';
import { useEffect, useState }     from 'preact/hooks';

const // shared components
Button      = await zugriff.component('Button'),
Breadcrumbs = await zugriff.component('Breadcrumbs'),
Empty       = await zugriff.component('Empty'),
FolderTree  = await zugriff.component('FolderTree'),
Icon        = await zugriff.component('Icon'),
IconButton  = await zugriff.component('IconButton'),
InstallTip  = await zugriff.component('InstallTip'),
Reader      = await zugriff.component('Reader'),
TOC         = await zugriff.component('TOC');

//
import FolderLibrary from '/.shared/js/modules/folders.js';

// ::: the app
const app = zugriff.app;
app.lib = new FolderLibrary({ accept: 'md, markdown, mdown, mkd, mdwn, mdtxt' });
const { fs } = zugriff;

// :::::: STATE

app.state.filter    = '';    // tree filter query
app.state.isNavOpen = false; // mobile: is the tree drawer showing

// durable state — hydrates from + persists to localStorage
const open = signal({ value: null, key: 'notes:open', store: local });   // { sourceId, path } | null

// :::::: TREE HELPERS

// derive a note's display title: the filename without its extension
const titleOf = node => node.name.replace(/\.[^.]+$/, '');

// :::::: SIDEBAR

function Sidebar () {
  return html`
    <aside class=${'sidebar' + (app.state.isNavOpen ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="notes" /> <span>Notes</span>
        <${Button} class="ibtn nav-close" icon='close' aria-label="Close" onClick=${() => app.state.isNavOpen = false} />
      </div>

      <div class="tree-filter">
        <${Icon} name="search" />
        <input type="search" placeholder="Filter notes…" value=${app.state.filter} onInput=${e => app.state.filter = e.target.value} />
        ${app.state.filter && html`<${Button} class="ibtn" icon='close' aria-label="Clear" onClick=${() => app.state.filter = ''} />`}
      </div>

      <${FolderTree}
        lib=${app.lib}
        filter=${app.state.filter}
        selected=${open.value}
        onOpen=${(sourceId, path) => { open.value = { sourceId, path }; app.state.isNavOpen = false; }}
        onRemoveSource=${id => { if (open.value?.sourceId === id) open.value = null; }}
        labelOf=${titleOf}
        fileIcon='notes'
        emptyText='No markdown files here'
        expandedKey='notes:expanded'
      />

      <div class="side-foot">
        <${InstallTip} show=${app.lib.sources.value.length > 0} />
        <${Button} class="small" icon='folder-add' label='Open a folder' onClick=${addFolder} />
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

  if (text == null) return html`<div class="reader-scroll"><div class="reader-grid"><div class="md-loading">…</div></div></div>`;

  return html`
    <div class="reader-scroll">
      <div class="reader-grid">

        <${Reader} id="notes-reader" class="md" format="markdown" text=${text} />

        <aside class="toc">
          <${TOC} target="#notes-reader" selector="h1, h2, h3" />
        </aside>

      </div>
    </div>
  `;
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

// :::::: APP

function EmptyReader () {
  let action, hint;
  const hasSources = app.lib.sources.value.length ? true : false;

  if (hasSources) {
    action = '';
    hint   = 'Choose a note to start reading.';
  } else {
    action = html`<${Button} class="primary" label='Open a folder' icon='folder-add' onClick=${addFolder} />`;    
    hint   = 'Open a folder of Markdown files to get started.';
  }
  
  return html`<${Empty} icon='notes' title='No note open' hint=${hint} action=${action} />`;
}

function NotesReader () {
  const hasSources = app.lib.sources.value.length ? true : false;
  const note = currentNote.value;
  const segs = note ? note.node.path.split('/') : [];
  
  return html`
    <div class='reader'>
      <header class='reader-head'>
        <${IconButton} icon='menu' aria-label="Open notes" onClick=${() => app.state.isNavOpen = true} />
        <${Breadcrumbs} segments=${segs} />
      </header>
  
      ${note ? html`<${NoteView} note=${note} />` : html`<${EmptyReader}/>`}
    </div>
  `;
}

function App () {
  useEffect(() => { app.lib.load().catch(app.toast); }, []);

  return (!app.lib.ready.value)
  ? html`<div class="booting"><${Icon} name='loading' /></div>`
  : html`<>
    <${Sidebar} />
    <main id='app-main'>
      <${NotesReader}/>
    </main>
  </>`;
}

// :::::: BOOT

app.init({ App });
