// apps/file-explorer/fs.js
//
// a small OPFS wrapper with directory support. shared/js/vfs.js is flat (root
// only) because the cli only ever needs the top level; the explorer walks a
// tree, so it gets its own helper here. it reads and writes the very same
// Origin Private File System, so a file the cli drops at the root shows up in
// the explorer and vice versa.
//
// a "path" throughout is an array of segment names, e.g. ['projects', 'src'].
// the root is [].

export const supported = () =>
  typeof navigator !== 'undefined' &&
  navigator.storage &&
  typeof navigator.storage.getDirectory === 'function';

const root = () => navigator.storage.getDirectory();

/** the directory handle at `path`, walking down from the root */
export async function dirAt (path = []) {
  let dir = await root();
  for (const name of path) dir = await dir.getDirectoryHandle(name, { create: false });
  return dir;
}

/** the entries in `path`, directories first then files, each sorted by name */
export async function list (path = []) {
  const dir  = await dirAt(path);
  const rows = [];

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      rows.push({ name, kind: 'directory' });
    } else {
      const file = await handle.getFile();
      rows.push({
        name,
        kind         : 'file',
        size         : file.size,
        lastModified : file.lastModified,
        type         : file.type,
      });
    }
  }

  return rows.sort((a, b) =>
    a.kind !== b.kind
      ? (a.kind === 'directory' ? -1 : 1)
      : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/** true if `name` already exists in `path` (either kind) */
export async function exists (path, name) {
  const dir = await dirAt(path);
  try { await dir.getFileHandle(name);      return true; } catch {}
  try { await dir.getDirectoryHandle(name); return true; } catch {}
  return false;
}

export async function mkdir (path, name) {
  const dir = await dirAt(path);
  await dir.getDirectoryHandle(name, { create: true });
}

/** create an empty file (no-op if it already exists) */
export async function touch (path, name) {
  const dir = await dirAt(path);
  await dir.getFileHandle(name, { create: true });
}

/** write `data` (Blob | ArrayBuffer | string) to a file, creating it */
export async function writeFile (path, name, data) {
  const dir      = await dirAt(path);
  const handle   = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

/** the File object at path/name */
export async function readFile (path, name) {
  const dir    = await dirAt(path);
  const handle = await dir.getFileHandle(name);
  return handle.getFile();
}

/** remove an entry; directories are removed recursively */
export async function remove (path, name) {
  const dir = await dirAt(path);
  await dir.removeEntry(name, { recursive: true });
}

// ── rename ───────────────────────────────────────────────────────────────
// OPFS has no move, so a rename is a copy followed by a delete. files copy in
// one write; directories are walked and rebuilt entry by entry.

async function copyDirInto (srcHandle, dstHandle) {
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

export async function rename (path, from, to, kind) {
  const dir = await dirAt(path);

  if (kind === 'directory') {
    const src = await dir.getDirectoryHandle(from);
    const dst = await dir.getDirectoryHandle(to, { create: true });
    await copyDirInto(src, dst);
  } else {
    const file     = await (await dir.getFileHandle(from)).getFile();
    const dst      = await dir.getFileHandle(to, { create: true });
    const writable = await dst.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
  }

  await dir.removeEntry(from, { recursive: true });
}

/** { usage, quota } in bytes, best-effort */
export async function usage () {
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return { usage: 0, quota: 0 };
}
