// apps/code/modules/webdav.js
//
// the WebDAV source of the code app — the same shape as the GitHub source
// (github.js), so it drops into the tree/files/treeops machinery. the protocol is
// the shared client (.shared/js/modules/webdav/client.js), this keeps the
// connections, the active one and their state.
//
// DIRECT ONLY: there is no proxy. the browser talks to the server straight, so the
// server MUST send CORS headers (Access-Control-Allow-Origin for this origin, and
// allow the WebDAV methods + the Authorization/Depth/Destination headers). that
// covers a self-hosted Nextcloud/ownCloud with CORS enabled, an rclone `serve
// webdav --cors`, or a caddy/nginx that injects the headers — not the big consumer
// clouds, which speak their own OAuth apis, not WebDAV.
//
// connections (incl. the password) live on-device in IndexedDB (@bunker/db, `webdav`
// store) and are sent only to their server. prefer an app-password where the server
// offers one.

import { signal } from '@aufbau/signals';
import * as dav from '/.shared/js/modules/webdav/client.js';
import { db, setup } from './db.js';

const CONNS_ID = 'connections';

// ── state ────────────────────────────────────────────────────────────────────

export const
connections = signal([]),     // [{ id, name, url, username, password }] — creds kept in memory
active      = signal(null),    // the selected connection, or null
busy        = signal(''),      // a label while a request is in flight
error       = signal(null),    // last error message
ready       = signal(false);   // hydration done

export const connected = () => !!active.value;
export const canWrite  = () => !!active.value && !active.value.readOnly;

export const connectionById = id => connections.value.find(c => c.id === id) || null;

// ── persistence ──────────────────────────────────────────────────────────────

export async function load () {
  await setup();
  const saved = await db.get('webdav', CONNS_ID);
  if (Array.isArray(saved)) connections.value = saved;
  ready.value = true;
}

async function persist () {
  await setup();
  await db.set('webdav', CONNS_ID, connections.value);
}

// ── connections ──────────────────────────────────────────────────────────────

// validate a connection by listing its root, then store + select it
export async function addConnection ({ name, url, username, password }) {
  const trimmed = (url || '').trim();
  if (!trimmed) throw new Error('Enter the WebDAV URL.');
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('The URL must start with http:// or https://');

  const conn = {
    id: `dav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: (name || '').trim() || new URL(trimmed).host,
    url: trimmed,
    username: (username || '').trim(),
    password: password || '',
  };

  busy.value = 'Connecting…'; error.value = null;
  try {
    await list('', conn);                       // a root PROPFIND proves url + auth + CORS
    connections.value = [...connections.value, conn];
    await persist();
    active.value = conn;
    return conn;
  } finally { busy.value = ''; }
}

export async function removeConnection (id) {
  connections.value = connections.value.filter(c => c.id !== id);
  await persist();
  if (active.value?.id === id) active.value = null;
}

export const selectConnection = id => { active.value = connectionById(id); };

// ── protocol ─────────────────────────────────────────────────────────────────
// the requests themselves live in .shared/js/modules/webdav/client.js, shared
// with the files app. here they get the active connection as their default.

/** immediate children of a collection path — [{ name, path, isDir, size, mime }] */
export const list = (path = '', c = active.value) => dav.list(c, path);

/** read a file to text; returns { text, binary } (a NUL byte ⇒ treat as binary) */
export async function readFile (path, c = active.value) {
  const bytes = new Uint8Array(await (await dav.read(c, path)).arrayBuffer());
  if (bytes.subarray(0, 8000).includes(0)) return { text: '', binary: true };
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), binary: false };
}

/** write text back to a file (PUT) */
export const writeFile = (path, content, c = active.value) => dav.write(c, path, content).then(() => {});

export const createFileAt   = (path, content = '', c = active.value) => writeFile(path, content, c);
export const createFolderAt = (path, c = active.value) => dav.mkcol(c, path);

export const deletePath = (path, { isDir } = {}, c = active.value) => dav.remove(c, path, !!isDir);   // collections delete recursively
export const renamePath = (from, to, { isDir } = {}, c = active.value) => dav.move(c, from, to, !!isDir);
export const copyPath   = (from, to, { isDir } = {}, c = active.value) => dav.copy(c, from, to, !!isDir);
