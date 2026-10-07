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

// the view on screen is #app's business (app-view, the hash)
app.state.$extend({
  bookKey : { type: 'scalar', value: null, persist: true },   // the book in the reader
  search  : { type: 'scalar', value: ''                  },
  folder  : { type: 'scalar', value: ''                  },   // '' = all folders, else sourceId
});

const current = signal('library');   // the view on screen

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

// :::::: FRAME :::::::::::::::::::::::::::::::::::::::::::::
// #app is the <app-root>: library and reader in the main area, the settings in the config area

const area = app.area;
const show = app.show;

app.root.addEventListener('navigate', event => { current.value = event.detail.to; });

app.toggleConfig = () => area('config')?.toggle();

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

app.openReader = key => {
  app.state.bookKey = key;
  app.db.markOpened(key);
  show('reader');
};

app.closeReader = () => show('library');

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

const // ::: shared components
Config = await zugriff.component('Config');

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

// the reader is mounted while it is on screen only, leaving it closes the book
function App () {
  useEffect(() => { app.db.load().catch(error => app.toast.error(error)); }, []);

  useEffect(() => {
    if (!app.db.ready.value) return;
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      current.value = app.root.view?.getAttribute('name') ?? 'library';
    });
  }, [app.db.ready.value]);

  if (!app.db.ready.value) return html`<div class="booting"><svg-icon icon="svg-spinners:bars-scale-middle" /></div>`;

  const key = app.state.$bookKey;

  return html`
    <app-area name='main'>
      <app-view name='library' route='/' active><${LibraryView} /></app-view>
      <app-view name='reader' route='/reader' transition-on='glide'>
        ${current.value === 'reader' && key && html`<${ReaderView} bookKey=${key} key=${key} />`}
      </app-view>
    </app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

app.init({ App });
