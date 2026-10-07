// downloader :: modules/frame.js
// the handles of #app, the <app-root>, and what the views share: the download shown in
// the context area, the view on screen.

import { signal } from '@aufbau/signals';

const app = zugriff.app;

export const show = app.show;
export const area = app.area;

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
