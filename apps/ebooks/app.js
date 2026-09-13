// apps/ebooks/app.js
// the ebook library + reader on the shared handle. the runtime binds zugriff (+ zugriff.app,
// html) to window before this runs, so nothing here imports the runtime. the library lives
// in the db module (app.db); ephemeral ui state on app.state; reading prefs are persisted
// scalars. the reader engines come from modules/reader.js.

// ::: vendors
import { signal, computed }  from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';

// ::: shared
const
Brand      = await zugriff.component('Brand'),
Empty      = await zugriff.component('Empty'),
Icon       = await zugriff.component('Icon'),
IconButton = await zugriff.component('IconButton'),
InstallTip = await zugriff.component('InstallTip'),
Settings   = await zugriff.component('Settings');

const // local
LibraryView = await app.view('LibraryView'),
ReaderView  = await app.view('ReaderView');

import { stored } from '/.shared/js/app/signals.js';

// ::: app modules
import { createPdfReader, createEpubReader } from './modules/reader.js';

// ::: the app handle
const app = zugriff.app;
app.db = await app.module('db');
app.fs = zugriff.fs;

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::
// ephemeral ui state on app.state (no `.value`); the library is app.db (plain signals). sort
// + the reader prefs are persisted scalars via `stored`.

app.state.route  = { name: 'library', key: null };   // { name:'library' } | { name:'reader', key }
app.state.search = '';
app.state.folder = '';                               // '' = all folders, else sourceId

const sort = stored('recent', 'ebooks:sort');        // recent | title | author | added

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const authorOf = b   => b.author || '';
const pct      = key => app.db.progressOf(key)?.percent ?? 0;

// a stable pastel from a title, for the placeholder cover
function hueOf (str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

const sortBooks = (list, mode) => [...list].sort((a, b) =>
    mode === 'title'  ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  : mode === 'author' ? authorOf(a).localeCompare(authorOf(b), undefined, { sensitivity: 'base' })
                        || a.title.localeCompare(b.title)
  : mode === 'added'  ? (b.addedAt || 0) - (a.addedAt || 0)
  : /* recent */        (db.progressOf(b.key)?.lastOpenedAt || 0) - (db.progressOf(a.key)?.lastOpenedAt || 0)
                        || (b.addedAt || 0) - (a.addedAt || 0));

const visibleBooks = computed(() => {
  const q = app.state.search.trim().toLowerCase();
  let list = db.books.value;
  if (app.state.folder) list = list.filter(b => b.sourceId === app.state.folder);
  if (q) list = list.filter(b =>
    b.title.toLowerCase().includes(q) || authorOf(b).toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  return sortBooks(list, sort.value);
});

const continueReading = computed(() =>
  db.books.value
    .filter(b => db.progressOf(b.key)?.lastOpenedAt)
    .sort((a, b) => (db.progressOf(b.key).lastOpenedAt) - (db.progressOf(a.key).lastOpenedAt))
    .slice(0, 12));

// :::::: READER VIEW :::::::::::::::::::::::::::::::::::::::

const readerUi = signal({ ready: false });

function openReader (key) {
  app.state.route = { name: 'reader', key };
  app.db.markOpened(key);
}
const closeReader = () => { app.state.route = { name: 'library', key: null }; };

// epub reading prefs, remembered across books
const readerFlow = stored('paginated', 'ebooks:flow');
const readerFont = stored(100, 'ebooks:font');

function TocPanel ({ items, kind, onPick }) {
  const render = list => html`
    <ul class="toc-list">
      ${(list || []).map((it, i) => html`
        <li key=${i}>
          <button class="toc-link" onClick=${() => onPick(kind === 'pdf' ? it.dest : it.href)}>${it.label || 'Untitled'}</button>
          ${it.children?.length ? render(it.children) : null}
        </li>`)}
    </ul>`;
  return html`
    <aside class="toc-panel">
      <div class="toc-head">Contents</div>
      ${items == null
        ? html`<div class="toc-loading"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`
        : items.length ? render(items) : html`<div class="toc-empty">No contents in this book.</div>`}
    </aside>`;
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function addFolder () {
  if (!fs.supported()) { flash('This browser can’t open folders — try Chrome, Edge or another Chromium browser.', 'err'); return; }
  try {
    const rec = await db.addFolder();
    if (rec) app.toast({ success: `Added ${rec.name}` });
  }
  catch (e) { app.toast(e); }
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  useEffect(() => { db.load().catch(app.toast); }, []);

  if (!db.ready.value) {
    return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;
  }

  const route = app.state.route;
  return route.name === 'reader'
    ? html`<${ReaderView} bookKey=${route.key} key=${route.key} />`
    : html`<main id="app-main"><${LibraryView} /></main>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
