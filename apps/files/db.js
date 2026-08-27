// apps/files/db.js
//
// the files app's only durable state is the one folder the user grants as the
// explorer's root. that lifecycle — persist the handle, re-ask for permission
// next visit instead of re-picking, forget it on demand — is the single-root
// shape of the shared FolderLibrary (shared/js/filesystem/folders.js). nothing
// on disk is ever copied; the app is a live view onto the granted folder.

import { zugriff } from './../../shared/js/runtime.js';

const lib = new zugriff.fs.FolderLibrary({
  db:       'zugriff-files',
  pickerId: 'zugriff-files',
  stores:   { root: {} },
  single:   true,
});

// ── signals ────────────────────────────────────────────────────────────────

export const { folder, perm, ready } = lib;   // folder:{name,handle,addedAt}|null · perm · ready

// ── the root folder ──────────────────────────────────────────────────────

/** pick (or change) the folder to browse. call straight from a click. */
export const grant = lib.grant;

/** fast path for a returning visit: re-grant the stored handle (call from the click). */
export const reconnect = lib.reconnect;

/** forget the folder — drops the handle only, never touches the files on disk. */
export const forget = lib.forget;

export const load = lib.load;
