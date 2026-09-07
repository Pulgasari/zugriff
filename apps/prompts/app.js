// apps/prompts/app.js
// the prompts app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. the library lives in the db
// module (app.db); ephemeral ui state on app.state; the two panes are loaded as panels.

// ::: app modules
import * as db            from './modules/db.js';
import { activePrompt }   from './modules/methods.js';

// ::: the app handle
const app = zugriff.app;
app.db = db;

// :::::: STATE
// ephemeral ui state on app.state (deep signal, no `.value`, read inside render). the
// library itself lives in app.db as its own plain signals.

app.state.search     = '';       // list filter text
app.state.activeTag  = null;     // tag id filter | null
app.state.sortBy     = 'name';   // name | createdAt | updatedAt
app.state.activeId   = null;     // selected prompt id | null
app.state.editMode   = false;    // false = view, true = edit/create
app.state.mobilePane = 'list';   // list | detail (mobile only)

// :::::: OPERATIONS
// cross-cutting ui + db moves the panels reach through the handle

app.newPrompt  = () => { app.state.activeId = null; app.state.editMode = true;  app.state.mobilePane = 'detail'; };
app.openPrompt = id => { app.state.activeId = id;   app.state.editMode = false; app.state.mobilePane = 'detail'; };
app.cancelEdit = () => { app.state.editMode = false; if (!activePrompt()) { app.state.activeId = null; app.state.mobilePane = 'list'; } };
app.back       = () => {
  if      (app.state.editMode)               app.cancelEdit();
  else if (app.state.mobilePane === 'detail') app.state.mobilePane = 'list';
};

app.savePrompt = async data => {
  await app.db.savePrompt(data);
  app.state.activeId = data.id;
  app.state.editMode = false;
};
app.removePrompt = async id => {
  await app.db.deletePrompt(id);
  if (app.state.activeId === id) { app.state.activeId = null; app.state.editMode = false; }
};
app.removeTag = async id => {
  await app.db.deleteTag(id);
  if (app.state.activeTag === id) app.state.activeTag = null;
};

// :::::: ACTIONS + HOTKEYS
// escape backs out of the edit form / the mobile detail pane

app.actions = { back: () => app.back() };
app.hotkeys.bind('escape', 'back', { global: true, when: () => app.state.editMode || app.state.mobilePane === 'detail' });

// :::::: UI

const
Sidebar = await app.panel('Sidebar'),
Detail  = await app.panel('Detail');

function App () {
  return html`
    <div id="app-main" class=${app.state.mobilePane === 'detail' ? 'mobile-detail' : ''}>
      <${Sidebar} />
      <${Detail} />
    </div>`;
}

// :::::: BOOT

app.init({ App });
