// apps/code/fsops.js
//
// file/folder operations for the local (File System Access) source. everything
// needs the *parent* directory handle, so the tree threads it down. rename/move
// use the native FileSystemHandle.move() where the browser has it (Chrome) and
// fall back to a recursive copy + delete everywhere else.

/** recursively copy an entry (file or directory) into destDir under `name` */
export async function copyInto (src, destDir, name) {
  if (src.kind === 'file') {
    const file = await src.getFile();
    const fh   = await destDir.getFileHandle(name, { create: true });
    const w    = await fh.createWritable();
    await w.write(file);   // a File is a Blob — written as a stream
    await w.close();
  } else {
    const nd = await destDir.getDirectoryHandle(name, { create: true });
    for await (const child of src.values()) await copyInto(child, nd, child.name);
  }
}

export const createFile = (dir, name) => dir.getFileHandle(name, { create: true });
export const createDir  = (dir, name) => dir.getDirectoryHandle(name, { create: true });
export const remove     = (dir, name) => dir.removeEntry(name, { recursive: true });

/** does `name` already exist in dir? (used to avoid silent overwrites) */
export async function exists (dir, name) {
  try { await dir.getFileHandle(name); return true; } catch {}
  try { await dir.getDirectoryHandle(name); return true; } catch {}
  return false;
}

/** rename an entry within its own directory */
export async function rename (dir, entry, newName) {
  if (entry.move) { try { await entry.move(newName); return; } catch {} }
  await copyInto(entry, dir, newName);
  await dir.removeEntry(entry.name, { recursive: true });
}

/** move an entry from srcDir into destDir (keeps its name) */
export async function moveInto (entry, srcDir, destDir) {
  if (entry.move) { try { await entry.move(destDir, entry.name); return; } catch {} }
  await copyInto(entry, destDir, entry.name);
  await srcDir.removeEntry(entry.name, { recursive: true });
}
