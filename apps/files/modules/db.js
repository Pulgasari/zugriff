// files :: modules/db.js

// the files app's only durable state is the one folder the user grants as the explorer's root:
// persist the handle, re-ask for permission next visit instead of re-picking, forget it on demand 
// — the single-root shape of the shared FolderLibrary (see '.shared/js/filesystem/folders.js').    
// nothing on disk is copied; the app is a live view.

const lib = new zugriff.fs.FolderLibrary({
  db       : 'zugriff-files',
  pickerId : 'zugriff-files',
  stores   : { root: {} },
  single   : true,
});

export const // signals
{ folder, perm, ready } = lib; // folder:{name,handle,addedAt}|null · perm · ready

export const // the root folder
grant     = lib.grant,     // pick (or change) the folder — call from a click
reconnect = lib.reconnect, // re-grant the stored handle on a returning visit
forget    = lib.forget,    // drop the handle only, never the files on disk
load      = lib.load;
