// .shared/js/modules/filesystem/index.js
//
// the filesystem layer, in five files, one clear layer each:
//   platform  where we run + how to get / persist a root handle (browser <-> capacitor)
//   handles   what you can do with a root handle: permissions, walk, tree crud
//   folders   FolderLibrary — the granted-folder lifecycle
//   scan      syncSource / MetaQueue — scan-into-records building blocks
//   opfs      the private origin storage (kept separate, hangs off zugriff.opfs)
//
// the runtime assembles platform + handles + folders + scan into one `zugriff.fs`;
// opfs stays its own `zugriff.opfs`. this barrel mirrors that for direct importers.

export * as platform from './platform.js';
export * as handles  from './handles.js';
//export { FolderLibrary } from './folders.js';
//export { syncSource, MetaQueue, signatureOf } from './scan.js';
//export { opfs, OPFS, vfs, VFS, opfsBackend, opfsSupported, usageEstimate } from './opfs.js';
