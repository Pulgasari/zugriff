// apps/notes/db.js
//
// notes has almost nothing to store: the app *is* a live view onto folders the
// user grants, so the only durable state is the set of granted directory
// handles. those live in one @bunker/db store ("sources"); a FileSystemHandle
// is structured-cloneable, so it round-trips through IndexedDB and we re-ask
// for permission on the next visit rather than re-picking the folder.
//
// everything shown on screen — the tree, a note's text — is read straight from
// disk on demand and never copied into the database.

import { signal } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
import * as fs from './../../shared/js/lib/fsaccess.js';

const db = createDb('zugriff-notes');

// what counts as a note. markdown and its usual spellings; a folder full of
// anything else simply scans to nothing.
const MD = /\.(md|markdown|mdown|mkd|mdwn|mdtxt)$/i;
export const accept = name => MD.test(name);

// ── signals ────────────────────────────────────────────────────────────────

export const
sources = signal([]),      // [{ id, name, handle, addedAt }]
trees   = signal({}),      // sourceId -> scanned tree node | null
perms   = signal({}),      // sourceId -> 'granted' | 'prompt' | 'denied'
scanning = signal({}),     // sourceId -> true while a scan is in flight
ready   = signal(false);

export const sourceById = id => sources.value.find(s => s.id === id) ?? null;

// ── loading ────────────────────────────────────────────────────────────────

export async function load () {
  await db.setup({ sources: {} });
  const rows = await db.getAll('sources');
  sources.value = Object.values(rows).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

  // resolve every handle's permission first (fast, never prompts) so the tree
  // never flashes a spurious "reconnect", then reveal the ui …
  await Promise.all(sources.value.map(async s => {
    const state = await fs.queryPermission(s.handle, 'read');
    perms.value = { ...perms.value, [s.id]: state };
  }));
  ready.value = true;

  // … and scan the already-granted folders in the background, so a big vault
  // doesn't hold up first paint
  sources.value.forEach(s => { if (perms.value[s.id] === 'granted') scan(s.id).catch(() => {}); });
}

// ── folders ──────────────────────────────────────────────────────────────

/** grant a new folder. returns the record, or null if the picker was dismissed. */
export async function addFolder () {
  const handle = await fs.pickDirectory({ id: 'zugriff-notes', mode: 'read' });
  if (!handle) return null;

  for (const s of sources.value) {
    if (await s.handle.isSameEntry?.(handle)) throw new Error('That folder is already open.');
  }

  const rec = { id: crypto.randomUUID(), name: handle.name, handle, addedAt: Date.now() };
  await db.set('sources', rec.id, rec);
  sources.value = [...sources.value, rec];
  perms.value   = { ...perms.value, [rec.id]: 'granted' };
  await scan(rec.id);
  return rec;
}

/** re-request read permission for a folder granted in an earlier session. */
export async function reconnect (id) {
  const s = sourceById(id);
  if (!s) return false;
  const ok = await fs.ensurePermission(s.handle, 'read');
  perms.value = { ...perms.value, [id]: ok ? 'granted' : 'denied' };
  if (ok) await scan(id);
  return ok;
}

/** forget a folder — drops the handle only, never touches the files on disk. */
export async function removeFolder (id) {
  await db.delete('sources', id);
  sources.value = sources.value.filter(s => s.id !== id);
  const t = { ...trees.value };   delete t[id];   trees.value   = t;
  const p = { ...perms.value };   delete p[id];   perms.value   = p;
}

// ── scanning ───────────────────────────────────────────────────────────────

export async function scan (id) {
  const s = sourceById(id);
  if (!s) return;
  scanning.value = { ...scanning.value, [id]: true };
  try {
    const tree = await fs.scanTree(s.handle, { accept });
    trees.value = { ...trees.value, [id]: tree };
  } catch (err) {
    if (err?.name === 'NotAllowedError') perms.value = { ...perms.value, [id]: 'prompt' };
    trees.value = { ...trees.value, [id]: { ...(trees.value[id]), error: err.message } };
    throw err;
  } finally {
    scanning.value = { ...scanning.value, [id]: false };
  }
}

export const rescanAll = () => Promise.all(
  sources.value.filter(s => perms.value[s.id] === 'granted').map(s => scan(s.id).catch(() => {})),
);

// ── reading ────────────────────────────────────────────────────────────────

/** the text of one note file */
export async function readNote (fileHandle) {
  const file = await fileHandle.getFile();
  return { text: await file.text(), lastModified: file.lastModified, size: file.size };
}
