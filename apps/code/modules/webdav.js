// apps/code/modules/webdav.js
//
// a tiny WebDAV client that runs entirely in the browser — the same shape as the
// GitHub source (github.js), so it drops into the tree/files/treeops machinery. it
// speaks WebDAV over fetch: PROPFIND to list, GET/PUT to read/write, MKCOL/DELETE/
// MOVE/COPY for folder ops, with HTTP Basic auth.
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

// ── url + auth helpers ───────────────────────────────────────────────────────

const authHeader = c => 'Basic ' + btoa(unescape(encodeURIComponent(`${c.username || ''}:${c.password || ''}`)));

const encodePath = path => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

// the base collection url, always with a trailing slash
const baseUrl = c => (c.url.endsWith('/') ? c.url : c.url + '/');

// absolute url for a path relative to the connection's base collection
const urlFor = (c, path = '', isDir = false) => {
  const u = new URL(encodePath(path), baseUrl(c)).href;
  return isDir && !u.endsWith('/') ? u + '/' : u;
};

// ── low-level request ────────────────────────────────────────────────────────

async function dav (c, path, { method = 'GET', headers = {}, body, isDir = false } = {}) {
  if (!c) throw new Error('No WebDAV connection.');
  let res;
  try {
    res = await fetch(urlFor(c, path, isDir), {
      method,
      headers: { Authorization: authHeader(c), ...headers },
      body,
    });
  } catch {
    // a cross-origin request the server does not CORS-allow rejects here with a
    // generic TypeError — surface the real cause
    throw new Error('Connection failed — the server must allow CORS (Access-Control-Allow-Origin) and the WebDAV methods for browser access.');
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentication failed — check the username / password.');
    if (res.status === 403) throw new Error('Forbidden — the account may lack permission here.');
    if (res.status === 404) throw new Error('Not found on the server.');
    if (res.status === 405) throw new Error('The server rejected the method (WebDAV may be disabled at this path).');
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res;
}

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

// ── PROPFIND (list one level) ────────────────────────────────────────────────

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<d:propfind xmlns:d="DAV:"><d:prop>' +
  '<d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/>' +
  '</d:prop></d:propfind>';

const DAV_NS = 'DAV:';
const firstText = (el, tag) => el.getElementsByTagNameNS(DAV_NS, tag)[0]?.textContent ?? '';

/** immediate children of a collection path — [{ name, path, isDir, size, mime }] */
export async function list (path = '', c = active.value) {
  const res = await dav(c, path, {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body: PROPFIND_BODY,
    isDir: true,
  });

  const xml  = new DOMParser().parseFromString(await res.text(), 'application/xml');
  const base = new URL(baseUrl(c)).pathname;                 // server path of the collection root
  const here = new URL(urlFor(c, path, true)).pathname;      // server path of the listed dir

  const rel = href => {
    const p = decodeURIComponent(new URL(href, c.url).pathname);
    return (p.startsWith(base) ? p.slice(base.length) : p).replace(/^\/+|\/+$/g, '');
  };

  const out = [];
  for (const r of xml.getElementsByTagNameNS(DAV_NS, 'response')) {
    const href = firstText(r, 'href');
    if (!href) continue;
    // skip the self entry (the listed directory itself)
    if (decodeURIComponent(new URL(href, c.url).pathname).replace(/\/+$/, '') === here.replace(/\/+$/, '')) continue;

    const isDir = r.getElementsByTagNameNS(DAV_NS, 'collection').length > 0;
    const childPath = rel(href);
    out.push({
      name : childPath.split('/').pop(),
      path : childPath,
      isDir,
      size : Number(firstText(r, 'getcontentlength')) || 0,
      mime : firstText(r, 'getcontenttype'),
    });
  }
  return out.sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1);
}

// ── read / write ─────────────────────────────────────────────────────────────

/** read a file to text; returns { text, binary } (a NUL byte ⇒ treat as binary) */
export async function readFile (path, c = active.value) {
  const res   = await dav(c, path);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.subarray(0, 8000).includes(0)) return { text: '', binary: true };
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), binary: false };
}

/** write text back to a file (PUT) */
export async function writeFile (path, content, c = active.value) {
  await dav(c, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: content,
  });
}

// ── file / folder operations (single requests) ───────────────────────────────

export const createFileAt   = (path, content = '', c = active.value) => writeFile(path, content, c);
export const createFolderAt = (path, c = active.value) => dav(c, path, { method: 'MKCOL', isDir: true });

export const deletePath = (path, { isDir } = {}, c = active.value) =>
  dav(c, path, { method: 'DELETE', isDir: !!isDir });   // collections delete recursively

const destHeader = (c, to, isDir) => ({ Destination: urlFor(c, to, isDir), Overwrite: 'F' });

export const renamePath = (from, to, { isDir } = {}, c = active.value) =>
  dav(c, from, { method: 'MOVE', headers: destHeader(c, to, isDir), isDir: !!isDir });

export const copyPath = (from, to, { isDir } = {}, c = active.value) =>
  dav(c, from, { method: 'COPY', headers: destHeader(c, to, isDir), isDir: !!isDir });
