// apps/files/db.js
//
// the files app's only durable state is the one folder the user grants as
// the explorer's root. a FileSystemDirectoryHandle is structured-cloneable, so
// it round-trips through one @bunker/db store and we re-ask for permission next
// visit instead of re-picking. nothing on disk is ever copied — the app is a
// live view onto the granted folder.

import { signal } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';
import * as fs from './../../shared/js/lib/fsaccess.js';

const db  = createDb('zugriff-files');
const KEY = 'root';                                 // a single granted root

// ── signals ────────────────────────────────────────────────────────────────

export const
folder = signal(null),        // { name, handle, addedAt } | null
perm   = signal('prompt'),    // 'granted' | 'prompt' | 'denied'
ready  = signal(false);

// ── loading ────────────────────────────────────────────────────────────────

export async function load () {
  await db.setup({ root: {} });
  const rec = await db.get('root', KEY);
  if (rec) {
    folder.value = rec;
    perm.value   = await fs.queryPermission(rec.handle, 'read');   // never prompts
  }
  ready.value = true;
}

// ── the root folder ──────────────────────────────────────────────────────

/**
 * pick a folder to browse (also the "change folder" path — the new one simply
 * replaces the old record). the shared picker id makes the OS remember where we
 * were. returns the record, or null if the picker was dismissed. must be called
 * straight from a click (showDirectoryPicker needs the user gesture).
 */
export async function grant () {
  const handle = await fs.pickDirectory({ id: 'zugriff-files', mode: 'read' });
  if (!handle) return null;
  const rec = { name: handle.name, handle, addedAt: Date.now() };
  await db.set('root', KEY, rec);
  folder.value = rec;
  perm.value   = 'granted';
  return rec;
}

/**
 * fast path for a returning visit: re-grant the stored handle. requestPermission
 * must run inside the click, so call this directly from the button. browsers are
 * flaky about re-granting a *stored* handle — grant() is the reliable fallback.
 */
export async function reconnect () {
  const rec = folder.value;
  if (!rec) return { granted: false };
  const res = await fs.requestRead(rec.handle, 'read');
  perm.value = res.granted ? 'granted' : (res.state ?? 'denied');
  return res;
}

/** forget the folder — drops the handle only, never touches the files on disk. */
export async function forget () {
  await db.delete('root', KEY);
  folder.value = null;
  perm.value   = 'prompt';
}
