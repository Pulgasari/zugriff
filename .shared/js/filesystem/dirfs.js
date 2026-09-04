// shared/js/filesystem/dirfs.js
//
// directory-tree operations over a FileSystemDirectoryHandle "root". the trick
// is that OPFS and a folder the user grants off their real disk expose the very
// same handle API — getDirectoryHandle / getFileHandle / entries / … — so one
// set of helpers drives both. only *where the root comes from* differs, and
// that is what a `backend` (below) captures.
//
// this is the generalised descendant of the old apps/file-explorer/fs.js (now apps/files):
// opfs.js stays flat (root only, all the cli needs); anything that
// walks a tree — the FileExplorer component, and through it the files
// app — uses this.
//
// a "path" throughout is an array of segment names, e.g. ['projects', 'src'].
// the root itself is [].

// ── walking ──────────────────────────────────────────────────────────────

/** the directory handle at `path`, walking down from `root` */
export async function dirAt (root, path = []) {
  let dir = root;
  for (const name of path) dir = await dir.getDirectoryHandle(name, { create: false });
  return dir;
}

/** the entries in `path`, directories first then files, each sorted by name */
export async function list (root, path = []) {
  const dir  = await dirAt(root, path);
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
export async function exists (root, path, name) {
  const dir = await dirAt(root, path);
  try { await dir.getFileHandle(name);      return true; } catch {}
  try { await dir.getDirectoryHandle(name); return true; } catch {}
  return false;
}

// ── writing ────────────────────────────────────────────────────────────────
// these need a writable root — OPFS always is, a granted on-disk folder only
// when it was picked with mode:'readwrite'. the FileExplorer component gates
// its write UI on backend.writable, so these are never reached read-only.

export async function mkdir (root, path, name) {
  const dir = await dirAt(root, path);
  await dir.getDirectoryHandle(name, { create: true });
}

/** create an empty file (no-op if it already exists) */
export async function touch (root, path, name) {
  const dir = await dirAt(root, path);
  await dir.getFileHandle(name, { create: true });
}

/** write `data` (Blob | ArrayBuffer | string) to a file, creating it */
export async function writeFile (root, path, name, data) {
  const dir      = await dirAt(root, path);
  const handle   = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

/** remove an entry; directories are removed recursively */
export async function remove (root, path, name) {
  const dir = await dirAt(root, path);
  await dir.removeEntry(name, { recursive: true });
}

// rename — the handle API has no move, so a rename is a copy followed by a
// delete. files copy in one write; directories are walked and rebuilt entry by
// entry.

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

export async function rename (root, path, from, to, kind) {
  const dir = await dirAt(root, path);

  if (kind === 'directory') {
    const src = await dir.getDirectoryHandle(from);
    const dst = await dir.getDirectoryHandle(to, { create: true });
    await copyDirInto(src, dst);
  } else {
    const handle   = await dir.getFileHandle(from);
    const file     = await handle.getFile();
    const dst      = await dir.getFileHandle(to, { create: true });
    const writable = await dst.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
  }

  await dir.removeEntry(from, { recursive: true });
}

// ── reading ────────────────────────────────────────────────────────────────

/** the File object at path/name */
export async function readFile (root, path, name) {
  const dir    = await dirAt(root, path);
  const handle = await dir.getFileHandle(name);
  return handle.getFile();
}

// ── backends ─────────────────────────────────────────────────────────────
// a backend hands the component a root and describes what it can do:
//
//   { id, label, writable, supported(), getRoot(), usage?() }
//
//   id        stable string, used for persisted keys
//   label     what to call this place in the ui ("private storage", a folder…)
//   writable  show the create / upload / rename / delete affordances?
//   supported is this backend usable in this browser at all?
//   getRoot   () => Promise<FileSystemDirectoryHandle>
//   usage     optional () => Promise<{ usage, quota }> for a storage meter
//
// the files app builds its own on-disk backend around a granted handle;
// the OPFS one every app can reach for is right here.

/** { usage, quota } in bytes for the origin's storage, best-effort */
export async function usageEstimate () {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return { usage: 0, quota: 0 };
}

const isFn = sth => typeof sth === 'function';
//export const opfsSupported = () => typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function';
export const opfsSupported = () => isFn(navigator?.storage?.getDirectory);

/**
 * the private on-device storage the cli owns. drop `<${FileExplorer}
 * backend=${opfsBackend} />` into any app to browse it.
 */
export const opfsBackend = {
  id        : 'opfs',
  label     : 'private storage',
  writable  : true,
  supported : opfsSupported,
  getRoot   : () => navigator.storage.getDirectory(),
  usage     : usageEstimate,
};
