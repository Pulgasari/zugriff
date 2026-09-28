// apps/ebooks/app.js
// the ebook library + reader on the shared handle. the runtime binds zugriff (+ zugriff.app,
// html) to window before this runs, so nothing here imports the runtime. the library lives
// in the db module (app.db); ephemeral ui state on app.state; reading prefs are persisted
// signals. the views read all of it off the handle.

const app = zugriff.app;

// :::::: IMPORT :::::::::::::::::::::::::::::::::::::::::::::

import { computed, signal, typedSignal } from '@aufbau/signals';
import { useEffect }                     from 'preact/hooks';

// :::::: HANDLE ::::::::::::::::::::::::::::::::::::::::::::
// before the views are imported: a component captured at module scope sees whatever
// was on the handle at import time

app.db = await app.module('db');
app.fs = zugriff.fs;

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::

app.state.route = { name: 'library', key: null };   // { name:'library' } | { name:'reader', key }
app.state.$extend({
  search : { type: 'scalar', value: '' },
  folder : { type: 'scalar', value: '' },   // '' = all folders, else sourceId
});

app.sort = typedSignal({ key: 'ebooks:sort', value: 'recent', values: ['recent', 'title', 'author', 'added'] });

// epub reading prefs, remembered across books
app.readerFlow = typedSignal({ key: 'ebooks:flow', value: 'paginated' });
app.readerFont = typedSignal({ key: 'ebooks:font', value: 100 });
app.readerUi   = signal({ ready: false });

// :::::: LIBRARY :::::::::::::::::::::::::::::::::::::::::::

const authorOf     = book => book.author || '';
const lastOpenedOf = book => app.db.progressOf(book.key)?.lastOpenedAt || 0;
const compare      = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const sortBooks = (list, mode) => [...list].sort((a, b) =>
    mode === 'title'  ? compare(a.title, b.title)
  : mode === 'author' ? compare(authorOf(a), authorOf(b)) || compare(a.title, b.title)
  : mode === 'added'  ? (b.addedAt || 0) - (a.addedAt || 0)
  : /* recent */        lastOpenedOf(b) - lastOpenedOf(a) || (b.addedAt || 0) - (a.addedAt || 0));

app.visibleBooks = computed(() => {
  const query = app.state.$search.trim().toLowerCase();
  let list = app.db.books.value;
  if (app.state.$folder) list = list.filter(book => book.sourceId === app.state.$folder);
  if (query) list = list.filter(book => [book.title, authorOf(book), book.name].some(text => text.toLowerCase().includes(query)));
  return sortBooks(list, app.sort.value);
});

app.percentOf = key => app.db.progressOf(key)?.percent ?? 0;

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

app.openReader = key => {
  app.state.route = { name: 'reader', key };
  app.db.markOpened(key);
};

app.closeReader = () => { app.state.route = { name: 'library', key: null }; };

app.addFolder = async () => {
  if (!app.fs.supported()) return app.toast.error('This browser can’t open folders — try Chrome, Edge or another Chromium browser.');
  try {
    const source = await app.db.addFolder();
    if (source) app.toast.success(`Added ${source.name}`);
  }
  catch (error) { app.toast.error(error); }
};

// :::::: VIEWS :::::::::::::::::::::::::::::::::::::::::::::

const { LibraryView, ReaderView } = await app.views('LibraryView', 'ReaderView');
const Icon = await zugriff.component('Icon');

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  useEffect(() => { app.db.load().catch(error => app.toast.error(error)); }, []);

  if (!app.db.ready.value) return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`;

  const route = app.state.$route;
  return route.name === 'reader'
    ? html`<${ReaderView} bookKey=${route.key} key=${route.key} />`
    : html`<main id="app-main"><${LibraryView} /></main>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
