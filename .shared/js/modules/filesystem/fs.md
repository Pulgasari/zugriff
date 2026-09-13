# fs

```javascript
const publicAPI = {};

const
createDir = (path)          => {}
readFile  = (path)          => {},
writeFile = (path, content) => {},
```

```javascript
zugriff.isNative

```

```javascript
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

```

```javascript
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
```
