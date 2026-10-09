// todo :: modules/sync.js
// the tasks as one json file in a place the user chose: a granted folder or a
// webdav place. written a moment after a change, read at the start and when the
// app comes back to the front, merged task by task (the newer one wins).
//
//   await sync.connect({ kind: 'folder' });                          // asks for a folder
//   await sync.connect({ kind: 'webdav', url, username, password, path: 'todo.json' });
//   await sync.pull();
//
// the place is kept in the db's meta table, a folder as its handle.

import { effect, signal } from '@aufbau/signals';

import * as dav   from '/.shared/js/modules/webdav/client.js';
import * as store from './store.js';

const app  = zugriff.app;
const fs   = zugriff.fs;
const FILE = 'todo.json';

export const place  = signal(null);   // { kind, name, … } without secrets for the ui
export const status = signal('');     // '', 'syncing', 'synced', an error message

let target = null;   // the full place, a folder with its live handle
let timer  = null;

// :::::: PLACES ::::::::::::::::::::::::::::::::::::::::::::::

const describe = target => target && ({ kind: target.kind, name: target.kind === 'folder' ? target.handle?.name : `${target.url} ${target.path ?? FILE}` });

async function read () {
  if (target.kind === 'folder') {
    if (!await fs.ensurePermission(target.handle, 'readwrite')) throw new Error('No access to the folder, open it again.');
    if (!await fs.exists(target.handle, [], FILE)) return null;
    return (await fs.readFile(target.handle, [], FILE)).text();
  }
  const path = target.path || FILE;
  if (!await dav.stat(target, path)) return null;
  return (await dav.read(target, path)).text();
}

async function write (text) {
  if (target.kind === 'folder') return fs.writeFile(target.handle, [], FILE, text);
  return dav.write(target, target.path || FILE, text);
}

// :::::: API :::::::::::::::::::::::::::::::::::::::::::::::::

export async function restore () {
  const saved = await app.db.meta.get('sync');
  if (!saved) return;
  target      = saved.kind === 'folder' ? { ...saved, handle: fs.hydrate(saved.handle) } : saved;
  place.value = describe(target);
}

export async function connect (options) {
  if (options.kind === 'folder') {
    const handle = await fs.pickDirectory({ id: 'todo', mode: 'readwrite' });
    if (!handle) return false;
    target = { kind: 'folder', handle };
    await app.db.meta.set('sync', { kind: 'folder', handle: fs.dehydrate(handle) });
  }
  else {
    target = { kind: 'webdav', password: options.password ?? '', path: options.path || FILE, url: options.url, username: options.username ?? '' };
    await dav.test(target);
    await app.db.meta.set('sync', target);
  }
  place.value = describe(target);
  await pull();
  return true;
}

export async function disconnect () {
  target       = null;
  place.value  = null;
  status.value = '';
  await app.db.meta.delete('sync');
}

// read the file, merge, write back what this side knows more
export async function pull () {
  if (!target) return;
  status.value = 'syncing';
  try {
    const text = await read();
    if (text) await store.merge(JSON.parse(text));
    await write(JSON.stringify(store.snapshot()));
    status.value = 'synced';
  }
  catch (error) { status.value = error.message; }
}

export async function push () {
  if (!target) return;
  status.value = 'syncing';
  try   { await write(JSON.stringify(store.snapshot())); status.value = 'synced'; }
  catch (error) { status.value = error.message; }
}

// after a local change a short pause, then one write for all of it
export function watch () {
  let first = true;
  effect(() => {
    store.changed.value;
    if (first) { first = false; return; }
    clearTimeout(timer);
    timer = setTimeout(push, 1500);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
}

export default { connect, disconnect, place, pull, push, restore, status, watch };
