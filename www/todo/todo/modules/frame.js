// todo :: modules/frame.js
// the handles of #app, the <app-root>, and what the views share: the task open in the
// editor, the list and tag a view shows, the view on screen.

import { signal, typedSignal } from '@aufbau/signals';

const app = zugriff.app;

export const show = app.show;
export const area = app.area;

// a drawer closes once something in it was picked, a sidebar stays
export const closeMenu = () => { if (area('menu')?.isOverlay) area('menu').hide(); };

export const current  = signal('today');
export const selected = signal(null);   // the id in the editor
export const list     = typedSignal({ type: 'scalar', value: 'inbox', key: 'todo:list', storage: 'local' });
export const tag      = typedSignal({ type: 'scalar', value: null,    key: 'todo:tag',  storage: 'local' });

export function edit (id) {
  selected.value = id;
  area('context')?.show();
}

export function closeEditor () {
  area('context')?.hide();
  selected.value = null;
}

export function openList (id) {
  list.value = id;
  show('list');
  closeMenu();
}

export function openTag (name) {
  tag.value = name;
  show('tag');
  closeMenu();
}

export function go (name) {
  show(name);
  closeMenu();
}
