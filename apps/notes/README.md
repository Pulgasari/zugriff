# apps/notes

A Markdown notebook that reads a folder straight off your disk. You grant one
or more folders with the browser's **File System Access API**; each folder is
walked recursively and its **folder structure becomes the outline** in the
sidebar. Selecting a `.md` file renders it in place.

Nothing is uploaded or copied. The only thing kept in the database is the
directory *handle* — a permission token — so the app can re-open the same
folder next time instead of asking you to pick it again.

## What it does

- **Open a folder** — `showDirectoryPicker()`. Add several; each is its own
  root in the tree. Your files are never modified.
- **Foldered outline** — the tree mirrors the directory structure exactly.
  Empty branches (no Markdown beneath them) are pruned away.
- **Live rendering** — notes are read on demand and rendered through
  `@aufbau/import`'s Markdown pipeline (`renderMD`). GFM tables, task lists,
  code, blockquotes and a generated *On this page* table of contents.
- **Vault-friendly** — relative images (`![](img/pic.png)`) are resolved back
  against the same granted folder and shown from a blob URL; relative
  `.md` links open the sibling note in-app, so an Obsidian-style vault reads
  as one connected document.
- **Filter** — type to narrow the tree to matching paths.
- **Persistent** — the open note, expanded folders and granted folders survive
  a reload. Coming back re-grants silently when the browser still remembers the
  permission, and offers a one-click *Reconnect* when it doesn't.

## Files

| file            | what it is |
|-----------------|------------|
| `index.html`    | static shell — links `../base.css`, `app.css` and the importmap |
| `app.js`        | the app: tree sidebar + Markdown reader, mounted via `boot({ shell:false })` |
| `db.js`         | the granted directory handles, in one `@bunker/db` store |
| `app.css`       | the app's own look |
| `app.config.js` | registry entry + aufbau runtime options |
| `manifest.json` | PWA manifest |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

The folder-picking, permission handling and recursive walk live in the shared
[`shared/js/lib/fsaccess.js`](../../shared/js/lib/fsaccess.js), which the
eBooks app reuses.

## Browser support

Needs the File System Access API (`window.showDirectoryPicker`) — Chrome, Edge
and other Chromium browsers. The app says so plainly where it isn't available.
