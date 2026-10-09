// files :: modules/remotes.js

/*
the servers the files app reaches besides the granted folder. webdav for now
(nextcloud and owncloud included, they speak it): a connection becomes a root
handle (.shared/js/modules/webdav/handles.js), so a tab browses it like the
folder, and copy, move, preview and thumbnails work across both.

the connections, password included, stay on the device: in opfs, sent only to
their own server. an app password is the better choice where the server has one.

connections   [{ id, name, password, url, username }]
add(fields)   tests the connection with a listing, then keeps it
rootOf(id)    the root handle, one per connection
*/

import createOPFS  from '@bunker/opfs';
import { signal }  from '@aufbau/signals';
import { test }    from '/.shared/js/modules/webdav/client.js';
import { davRoot } from '/.shared/js/modules/webdav/handles.js';

const STORE = 'remotes';
const store = createOPFS ({ directory: 'zugriff/files' });
const roots = new Map;
const connections = signal([]);

async function load () { connections.value = await store.get(STORE).catch(() => null) ?? []; }

const persist = () => store.set(STORE, connections.value);
const byId    = id => connections.value.find(connection => connection.id === id) ?? null;

async function add ({ name, password = '', url, username = '' }) {
  const trimmed = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('The url has to start with http:// or https://');

  const connection = {
    id       : `dav-${Date.now().toString(36)}`,
    name     : String(name ?? '').trim() || new URL(trimmed).host,
    password,
    url      : trimmed,
    username : String(username).trim(),
  };

  await test(connection);
  connections.value = [...connections.value, connection];
  await persist();
  return connection;
}

async function remove (id) {
  connections.value = connections.value.filter(connection => connection.id !== id);
  roots.delete(id);
  await persist();
}

function rootOf (id) {
  const connection = byId(id);
  if (!connection) return null;
  if (!roots.has(id)) roots.set(id, davRoot(connection));
  return roots.get(id);
}

// :::::: EXPORT

export { add, byId, connections, load, remove, rootOf };
