// apps/todo/app.js

// :::::: IMPORT

// the frame is aufbau's: an <app-root> with the views in its main area, the
// lists and tags in a menu area at the start, the task being edited in a context
// area at the bottom and the settings in a config area at the end

import { computed }          from '@aufbau/signals';
import { useEffect }         from 'preact/hooks';

import PopPrompt from '@aufbau/elements/webcomponents/pop-prompt.js';

import { Config }                           from './components/Config.js';
import { Editor }                           from './components/Editor.js';
import { AddBar, Section, tickTask }        from './components/Task.js';
import { addDays, dayLabel, dayOf, dueDay } from './modules/dates.js';
import * as frame                           from './modules/frame.js';
import reminders                            from './modules/reminders.js';
import * as store                           from './modules/store.js';
import sync                                 from './modules/sync.js';

const { area, current, go, openList, openTag, show } = frame;

const // shared components
Brand       = await zugriff.component('Brand'),
Button      = await zugriff.component('Button'),
Dock        = await zugriff.component('Dock'),
Empty       = await zugriff.component('Empty'),
Icon        = await zugriff.component('Icon'),
IconButton  = await zugriff.component('IconButton'),
InstallTip  = await zugriff.component('InstallTip'),
SearchPanel = await zugriff.component('SearchPanel');

// :::::: APP

const app = zugriff.app;
app.db = app.database;

app.state.$extend({
  filter : { type: 'scalar', value: '' },
});

await store.load().catch(app.toast);
await sync.restore().catch(app.toast);
sync.watch();
sync.pull();
reminders.start();

// :::::: QUERIES

const open = computed(() => store.tasks.value.filter(task => !task.done && !task.parent));

const matches = (task, query) => [task.title, task.notes, ...task.tags].some(text => text?.toLowerCase().includes(query));

// a view's tasks in titled groups
const SECTIONS = {
  today () {
    const today = dayOf();
    return [
      { title: 'overdue', tasks: open.value.filter(task => task.due && dueDay(task.due) < today).sort(store.byDue) },
      { title: 'today',   tasks: open.value.filter(task => dueDay(task.due) === today).sort(store.byDue), empty: 'nothing due today' },
      { title: 'high priority', tasks: open.value.filter(task => !task.due && task.priority === 3).sort(store.byOrder) },
    ];
  },

  upcoming () {
    const today = dayOf();
    const limit = addDays(today, 28);
    const days  = new Map;
    for (const task of open.value.filter(task => task.due && dueDay(task.due) > today && dueDay(task.due) <= limit).sort(store.byDue)) {
      const day = dueDay(task.due);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(task);
    }
    return [
      ...[...days].map(([day, tasks]) => ({ title: dayLabel(day), tasks })),
      { title: 'later', tasks: open.value.filter(task => task.due && dueDay(task.due) > limit).sort(store.byDue), collapsed: true },
    ];
  },

  someday () {
    return [{ tasks: open.value.filter(task => !task.due && task.list === store.INBOX).sort(store.byOrder), empty: 'no undated tasks in the inbox' }];
  },

  list () {
    const id = frame.list.value;
    return [
      { tasks: open.value.filter(task => task.list === id).sort(store.byOrder), empty: 'nothing to do here' },
      { title: 'done', tasks: store.tasks.value.filter(task => task.done && !task.parent && task.list === id).sort((a, b) => b.done - a.done), collapsed: true },
    ];
  },

  tag () {
    const name = frame.tag.value;
    return [{ tasks: open.value.filter(task => task.tags.includes(name)).sort(store.byDue), empty: 'no open task with this tag' }];
  },

  done () {
    const days = new Map;
    for (const task of store.tasks.value.filter(task => task.done && !task.parent).sort((a, b) => b.done - a.done).slice(0, 300)) {
      const day = dayOf(new Date(task.done));
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(task);
    }
    return [...days].map(([day, tasks]) => ({ title: dayLabel(day), tasks }));
  },

  search () {
    const query = app.state.$filter.trim().toLowerCase();
    if (!query) return [];
    const found = store.tasks.value.filter(task => !task.parent && matches(task, query));
    return [
      { tasks: found.filter(task => !task.done).sort(store.byDue), empty: 'no open task matches' },
      { title: 'done', tasks: found.filter(task => task.done), collapsed: true },
    ];
  },
};

const TITLES = { done: 'Done', search: 'Search', someday: 'Someday', today: 'Today', upcoming: 'Upcoming' };

const titleOf = name => {
  if (name === 'list') return store.lists.value.find(list => list.id === frame.list.value)?.name ?? 'List';
  if (name === 'tag')  return `#${frame.tag.value ?? ''}`;
  return TITLES[name];
};

// what the add field fills in on its own in each view
const defaultsOf = name => ({
  due  : name === 'today' ? dayOf()          : null,
  list : name === 'list'  ? frame.list.value : null,
  tag  : name === 'tag'   ? frame.tag.value  : null,
});

// :::::: ACTIONS

async function newList () {
  const name = await PopPrompt.prompt('name of the list', '');
  if (!name?.trim()) return;
  const list = await store.addList(name.trim());
  openList(list.id);
}

async function renameList (id) {
  const list = store.lists.peek().find(item => item.id === id);
  const name = await PopPrompt.prompt('rename the list', list.name);
  if (name?.trim()) await store.renameList(id, name.trim());
}

async function deleteList (id) {
  const list = store.lists.peek().find(item => item.id === id);
  if (!await PopPrompt.confirm(`delete "${list.name}"? its tasks go to the inbox.`, { confirm: 'delete' })) return;
  await store.removeList(id);
  go('today');
}

function focusAdd () {
  requestAnimationFrame(() => document.querySelector(`app-view[name="${current.peek()}"] #todo-add, #todo-add`)?.focus());
}

function focusSearch () {
  area('menu')?.show();
  requestAnimationFrame(() => document.querySelector('.menu .search-panel input, .menu input-search')?.focus());
}

app.actions = {
  'close'    : () => frame.closeEditor(),
  'edit'     : () => frame.selected.peek() && area('context')?.show(),
  'new'      : focusAdd,
  'search'   : focusSearch,
  'tick'     : () => frame.selected.peek() && tickTask(frame.selected.peek()),
  'today'    : () => go('today'),
  'undo'     : async () => { const label = await store.undo(); if (label) app.toast(`undone: ${label}`); },
  'upcoming' : () => go('upcoming'),
};

app.hotkeys = {
  'n'        : { action: 'new' },
  '/'        : { action: 'search' },
  't'        : { action: 'today' },
  'u'        : { action: 'upcoming' },
  'x'        : { action: 'tick', when: () => !!frame.selected.peek() },
  'e'        : { action: 'edit', when: () => !!frame.selected.peek() },
  'escape'   : { action: 'close', when: () => !!frame.selected.peek() },
  'ctrl + z' : { action: 'undo' },
};

// the search shows its own view while there is a query
app.effect(() => {
  const query = app.state.$filter.trim();
  if (query && current.peek() !== 'search') show('search');
  if (!query && current.peek() === 'search') show('today');
});

// :::::: MENU

function NavItem ({ icon, label, count, active, onClick, children }) {
  return html`
    <div class='nav-item' aria-current=${active ? 'page' : null}>
      <button type='button' class='nav-link' onClick=${onClick}>
        <${Icon} name=${icon} /><span>${label}</span>${count ? html`<span class='count'>${count}</span>` : ''}
      </button>
      ${children}
    </div>
  `;
}

function Menu () {
  const today   = dayOf();
  const view    = current.value;
  const counts  = {
    today    : open.value.filter(task => task.due && dueDay(task.due) <= today).length,
    upcoming : open.value.filter(task => task.due && dueDay(task.due) > today).length,
    someday  : open.value.filter(task => !task.due && task.list === store.INBOX).length,
  };
  const listCount = id => open.value.filter(task => task.list === id).length;
  const tagCount  = name => open.value.filter(task => task.tags.includes(name)).length;

  return html`
    <div class='menu'>
      <${Brand} app=${app} />
      <${SearchPanel} placeholder='search tasks ...' appStateId='filter' />

      <nav>
        <${NavItem} icon='lucide:sun' label='Today' count=${counts.today} active=${view === 'today'} onClick=${() => go('today')} />
        <${NavItem} icon='lucide:calendar-days' label='Upcoming' count=${counts.upcoming} active=${view === 'upcoming'} onClick=${() => go('upcoming')} />
        <${NavItem} icon='lucide:cloud' label='Someday' count=${counts.someday} active=${view === 'someday'} onClick=${() => go('someday')} />
        <${NavItem} icon='lucide:circle-check' label='Done' active=${view === 'done'} onClick=${() => go('done')} />
      </nav>

      <h4 class='menu-head'>lists <${IconButton} icon='lucide:plus' title='new list' onClick=${newList} /></h4>
      <nav>
        ${store.lists.value.map(list => html`
          <${NavItem} key=${list.id} icon=${list.id === store.INBOX ? 'lucide:inbox' : 'lucide:list'} label=${list.name} count=${listCount(list.id)}
                      active=${view === 'list' && frame.list.value === list.id} onClick=${() => openList(list.id)}>
            ${list.id !== store.INBOX && html`
              <${IconButton} icon='lucide:pencil' title='rename' onClick=${() => renameList(list.id)} />
              <${IconButton} icon='lucide:trash-2' title='delete' onClick=${() => deleteList(list.id)} />
            `}
          <//>
        `)}
      </nav>

      ${store.tags.value.length > 0 && html`
        <h4 class='menu-head'>tags</h4>
        <nav class='tags'>
          ${store.tags.value.map(name => html`
            <${NavItem} key=${name} icon='lucide:hash' label=${name} count=${tagCount(name)} active=${view === 'tag' && frame.tag.value === name} onClick=${() => openTag(name)} />
          `)}
        </nav>
      `}

      <div class='side-foot'><${InstallTip} /></div>
    </div>
  `;
}

// :::::: VIEWS

function Header ({ title }) {
  return html`
    <header>
      <${IconButton} icon='menu' title='lists' onClick=${() => area('menu')?.toggle()} />
      <h2>${title}</h2>
      <${IconButton} icon='settings' title='settings' onClick=${() => area('config')?.toggle()} />
    </header>
  `;
}

function TaskView ({ name }) {
  const sections = SECTIONS[name]();
  const empty    = sections.every(section => !section.tasks.length) && !sections.some(section => section.empty);

  return html`
    <div class='view'>
      <${Header} title=${titleOf(name)} />
      ${name !== 'done' && name !== 'search' && html`<${AddBar} defaults=${defaultsOf(name)} />`}
      <main class='groups'>
        ${empty
          ? html`<${Empty} icon='lucide:circle-check' title='All clear' hint=${name === 'done' ? 'nothing done yet' : 'nothing here'} />`
          : sections.map((section, index) => html`<${Section} key=${section.title ?? index} ...${section} />`)}
      </main>
    </div>
  `;
}

// :::::: ROOT

const VIEWS = [
  { name: 'today',    route: '/'         },
  { name: 'upcoming', route: '/upcoming' },
  { name: 'someday',  route: '/someday'  },
  { name: 'list',     route: '/list'     },
  { name: 'tag',      route: '/tag'      },
  { name: 'done',     route: '/done'     },
  { name: 'search',   route: '/search'   },
];

// the dock's items call app.go
app.go = name => go(name);

const dockItems = [
  { icon: 'lucide:sun',           label: 'today',    view: 'today'                                                            },
  { icon: 'lucide:calendar-days', label: 'upcoming', view: 'upcoming'                                                         },
  { icon: 'lucide:list',          label: 'lists',    onClick: () => area('menu')?.toggle(), match: ['list', 'tag', 'someday', 'done'] },
  { icon: 'settings',             label: 'settings', onClick: () => area('config')?.toggle()                                  },
];

function onNavigate (event) {
  current.value = event.detail.to;
}

app.root.addEventListener('navigate', onNavigate);

// the areas of #app, the root
function App () {
  // the lists are the way through the tasks: a sidebar from the start where there
  // is room. the elements are defined by the autoloader, so this waits for them
  useEffect(() => {
    Promise.all(['app-root', 'app-area'].map(tag => customElements.whenDefined(tag))).then(() => {
      const menu = area('menu');
      if (menu && !menu.isOverlay) menu.show();
      current.value = app.root.view?.getAttribute('name') ?? 'today';
    });
  }, []);

  return html`
    <app-area name='main'>
      ${VIEWS.map(({ name, route }) => html`
        <app-view key=${name} name=${name} route=${route} transition-on='glide' active=${name === 'today' || undefined}><${TaskView} name=${name} /></app-view>
      `)}
      <${Dock} items=${dockItems} current=${current.value} />
    </app-area>
    <app-area name='menu' dock='start'><${Menu} /></app-area>
    <app-area name='context' dock='bottom' ontoggle=${event => { if (!event.detail?.open) frame.selected.value = null; }}><${Editor} /></app-area>
    <app-area name='config' dock='end'><${Config} /></app-area>
  `;
}

// :::::: BOOT

app.init({ App });
