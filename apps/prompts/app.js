// apps/prompts/app.js
// the prompts app on the shared handle. the runtime binds zugriff (+ zugriff.app, html) to
// window before this runs, so nothing here imports the runtime. the library lives in the db
// module (app.lib); ephemeral ui state on app.state; the two panes are loaded as panels.
// the frame is #app, the <app-root>: the list in a menu area at the start (a sidebar
// where there is room, a drawer where not), the prompt in the main area.

// ::: app modules
import { useEffect } from '/.shared/js/vendors.js';

import * as lib         from './modules/lib.js';
import { activePrompt } from './modules/methods.js';

// ::: the app handle
const app = zugriff.app;
app.lib = lib;
await lib.load().catch(error => app.toast.error(error));

// :::::: STATE
// ephemeral ui state on app.state (deep signal, no `.value`, read inside render). the
// library itself lives in app.lib as its own plain signals.

app.state.$extend({
  search     : { type: 'scalar', value: '' },       // list filter text
  activeTag  : { type: 'scalar', value: null },     // tag id filter | null
  sortBy     : { type: 'scalar', value: 'name' },   // name | createdAt | updatedAt
  activeId   : { type: 'scalar', value: null },     // selected prompt id | null
  editMode   : { type: 'scalar', value: false },    // false = view, true = edit/create
});

// :::::: FRAME
// a drawer closes once something in it was picked, a sidebar stays

const menu      = () => app.area('menu');
const closeMenu = () => { if (menu()?.isOverlay) menu().hide(); };
app.showList    = () => menu()?.show();

// :::::: OPERATIONS
// cross-cutting ui + db moves the panels reach through the handle

app.newPrompt  = () => { app.state.activeId = null; app.state.editMode = true;  closeMenu(); };
app.openPrompt = id => { app.state.activeId = id;   app.state.editMode = false; closeMenu(); };
app.cancelEdit = () => { app.state.editMode = false; if (!activePrompt()) { app.state.activeId = null; app.showList(); } };
app.back       = () => {
  if (app.state.$editMode) app.cancelEdit();
  else                     app.showList();
};

app.savePrompt = async data => {
  await app.lib.savePrompt(data);
  app.state.activeId = data.id;
  app.state.editMode = false;
};
app.removePrompt = async id => {
  await app.lib.deletePrompt(id);
  if (app.state.$activeId === id) { app.state.activeId = null; app.state.editMode = false; }
};
app.removeTag = async id => {
  await app.lib.deleteTag(id);
  if (app.state.$activeTag === id) app.state.activeTag = null;
};

// :::::: ACTIONS

app.actions = { 'back': () => app.back() };

// :::::: HOTKEYS
// escape backs out of the edit form / the mobile detail pane

app.hotKeys = {
  'escape' : { action: 'back', global: true, when: () => app.state.$editMode || (menu()?.isOverlay && !menu().hasAttribute('open')) },
};

// :::::: UI

const
Sidebar   = await app.panel('Sidebar'),
Detail    = await app.panel('Detail'),
{ Views } = await zugriff.components('Views');

// one view, the prompt picked in the list
app.views = {
  prompt : { route: '/', view: Detail },
};

// the areas of #app, the root
function App () {
  // the list from the start where there is room, and on a phone while nothing is open.
  // the elements are defined by the autoloader, so this waits for them
  useEffect(() => {
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      if (!menu()?.isOverlay || !activePrompt()) menu()?.show();
    });
  }, []);

  return html`
    <app-area name='main'>
      <${Views} />
    </app-area>
    <app-area name='menu' dock='start'><${Sidebar} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
