

/*
const publicAPI = {};

const
createDir = (path)          => {}
readFile  = (path)          => {},
writeFile = (path, content) => {},


zugriff.isNative

*/

/*
fs.isSupported

fs.pickDir
fs.pickFile

fs.create
fs.delete
fs.move
fs.read
fs.rename

fs.exists
fs.lastModified
fs.meta
fs.size
fs.type

fs.createFile
fs.deleteFile
fs.moveFile
fs.readFile
fs.renameFile

fs.createDir
fs.deleteDir
fs.moveDir
fs.readDir
fs.renameDir

*/

// ::: COPY
copyDir = async (srcHandle, dstHandle) => {
  for await (const [name, handle] of srcHandle.entries()) {
    if (handle.kind === 'directory') {
      const child = await dstHandle.getDirectoryHandle(name, { create: true });
      await copyDirInto(handle, child);
    } else {
      const file     = await handle.getFile();
      const target   = await dstHandle.getFileHandle(name, { create: true });
      const writable = await target.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    }
  }
}

// ::: CREATE
createDir = async (root, path, name) => {
  const dir = await dirAt(root, path);
  await dir.getDirectoryHandle(name, { create: true });
}

// ::: DELETE
delete = (root, path, name) => {
  const dir = await dirAt(root, path);
  await dir.removeEntry(name, { recursive: true });
}

// ::: EXISTS
exists = async (root, path, name) => {
  const dir = await dirAt(root, path);
  try { await dir.getFileHandle(name);      return true; } catch {}
  try { await dir.getDirectoryHandle(name); return true; } catch {}
  return false;
}

// ::: READ
readFile = async (root, path, name) => {
  const dir    = await dirAt(root, path);
  const handle = await dir.getFileHandle(name);
  return handle.getFile();
}

// ::: rename
rename = async (root, path, from, to, kind) => {
  switch (kind) {
    case 'dir'  : return renameDir  (root, path, from, to);
    case 'file' : return renameFile (root, path, from, to);
  }
}
renameDir = async (root, path, from, to) => {
  const dir = await dirAt(root, path);
  const src = await dir.getDirectoryHandle(from);
  const dst = await dir.getDirectoryHandle(to, { create: true });

  await copyDirInto(src, dst);
  await dir.removeEntry(from, { recursive: true });
}
renameFile = async (root, path, from, to) => {
  const dir      = await dirAt(root, path);
  const handle   = await dir.getFileHandle(from);
  const file     = await handle.getFile();
  const dst      = await dir.getFileHandle(to, { create: true });
  const writable = await dst.createWritable();

  await writable.write(await file.arrayBuffer());
  await writable.close();
  await dir.removeEntry(from, { recursive: true });
}

/*

// :::::: CAPACITOR

globalThis.Capacitor                        // die Bridge (nur im nativen WebView da)
globalThis.Capacitor.Plugins.Filesystem     // @capacitor/filesystem
globalThis.Capacitor.Plugins.FilePicker     // @capawesome/capacitor-file-picker

FilePicker.pickDirectory ()                 // → { path: "content://.../tree/primary:Music" }

Filesystem.readdir    ({ path })            // → { files: [{ name, type, size, mtime, uri }, ...] }
Filesystem.readFile   ({ path })            // → { data: "<base64>" }
Filesystem.stat       ({ path })            // → { type, size, ctime, mtime, uri }
Filesystem.writeFile  ({ path, data })      // data = base64
Filesystem.mkdir      ({ path, recursive })
Filesystem.rmdir      ({ path, recursive })
Filesystem.deleteFile ({ path })

// :::::: WEB

// window global — existiert nur auf Desktop-Chromium, NICHT im Android-WebView
const dir = await window.showDirectoryPicker({ id, mode, startIn });
// → FileSystemDirectoryHandle

// FileSystemDirectoryHandle
dir.kind            // 'directory'
dir.name            // string
for await (const [name, handle] of dir.entries()) { ... }
await dir.getFileHandle(name, { create })
await dir.getDirectoryHandle(name, { create })
await dir.removeEntry(name, { recursive })

// FileSystemFileHandle
fh.kind                                      // 'file'
const file     = await fh.getFile()          // → File (erst hier size/mtime/type)
const writable = await fh.createWritable()   // write/close

// Permissions (Chromium-Erweiterung am Handle)
await handle.queryPermission   ({ mode })   // 'granted'|'prompt'|'denied'
await handle.requestPermission ({ mode })

// OPFS — auch Browser-API, aber ohne Picker:
const root = await navigator.storage.getDirectory()   // FileSystemDirectoryHandle
await navigator.storage.estimate()                    // { usage, quota }




*/
