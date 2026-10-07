// todo :: modules/frame.js
// the handles of the <app-root> and what the views share: the task open in the
// editor, the list and tag a view shows, the view on screen.

import { signal, typedSignal } from '@aufbau/signals';

export const rootRef = { current: null };

export const show = name => rootRef.current?.show(name);
export const area = name => rootRef.current?.area(name);

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
