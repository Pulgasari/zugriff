// apps/files/modules/db.js
//
// the files app's only durable state is the one folder the user grants as the explorer's
// root: persist the handle, re-ask for permission next visit instead of re-picking, forget
// it on demand — the single-root shape of the shared FolderLibrary (see
// .shared/js/filesystem/folders.js). nothing on disk is copied; the app is a live view.
//
// zugriff is global (bound by boot.js), so a module never imports the runtime.

const lib = new zugriff.fs.FolderLibrary({
  db:       'zugriff-files',
  pickerId: 'zugriff-files',
  stores:   { root: {} },
  single:   true,
});

// ── signals ────────────────────────────────────────────────────────────────

export const { folder, perm, ready } = lib;   // folder:{name,handle,addedAt}|null · perm · ready

// ── the root folder ──────────────────────────────────────────────────────

export const grant     = lib.grant;       // pick (or change) the folder — call from a click
export const reconnect = lib.reconnect;    // re-grant the stored handle on a returning visit
export const forget     = lib.forget;      // drop the handle only, never the files on disk
export const load      = lib.load;
