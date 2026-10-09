// .shared/js/modules/fs.js
//
// zugriff.fs — the stateless filesystem primitives, in two layers:
//
//   platform   where we run, how to pick a root handle and how to persist one
//              (browser <-> capacitor), plus the ext/mime table
//   handles    everything you can do given a root handle: permissions, the
//              recursive walk, tree crud
//
// no storage, no signals, no ui. the stateful layer on top of this is
// FolderLibrary — it USES zugriff.fs and is therefore not part of it; import it
// directly from '/.shared/js/modules/folders.js'. the private origin storage is
// its own zugriff.opfs, for the same reason (see opfs.js).

export * from './filesystem/handles.js';
export * from './filesystem/platform.js';
