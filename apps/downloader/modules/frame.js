// downloader :: modules/frame.js
// the handles of the <app-root> and what the views share: the download shown in
// the context area, the view on screen.

import { signal } from '@aufbau/signals';

export const rootRef = { current: null };

export const show = name => rootRef.current?.show(name);
export const area = name => rootRef.current?.area(name);

export const current  = signal('queue');
export const selected = signal(null);   // the id in the context area

export function inspect (id) {
  selected.value = id;
  area('context')?.show();
}

export function closeDetail () {
  area('context')?.hide();
  selected.value = null;
}
