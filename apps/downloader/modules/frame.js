// downloader :: modules/frame.js
// what the views share: the download shown in the context area of #app

import { signal } from '@aufbau/signals';

const area = name => zugriff.app.area(name);

export const selected = signal(null);   // the id in the context area

export function inspect (id) {
  selected.value = id;
  area('context')?.show();
}

export function closeDetail () {
  area('context')?.hide();
  selected.value = null;
}
