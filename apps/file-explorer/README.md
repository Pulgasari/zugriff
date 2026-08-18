# apps/file-explorer

A file explorer for the browser's **Origin Private File System** (OPFS) — the
private, per-origin storage that lives on the device and never leaves it. It
reads and writes the very same OPFS the [`cli`](./../../cli/) uses, so a file
you drop in the terminal shows up here and vice versa.

## what it does

- browse a real directory tree — double-click a folder to open it, breadcrumb
  or `Backspace` to go back
- **create** folders and files, **upload** (button or drag-and-drop), **rename**,
  **delete** (recursive), and **download** any file back out
- a details panel with inline previews — images render, small text files show
  their contents
- list and grid views, a live filter, and a storage meter (`navigator.storage`)

Everything is client-side; nothing is uploaded anywhere.

## how it's built

This is an *app*, not a *tool*: it draws its own chrome and brings its own css
(`app.css` over `apps/base.css`), instead of the tools' `Shell` and
`shared/css/index.css`. It still shares the theme tokens, the import map, the
aufbau runtime and the service worker with the rest of zugriff.

| file            | what it is |
|-----------------|------------|
| `app.js`        | the explorer UI (preact + htm + signals), booted with `shell: false` |
| `fs.js`         | a small OPFS wrapper with directory support (the tree `shared/js/vfs.js` doesn't need) |
| `app.css`       | the app's own look — sidebar, toolbar, listing, details, status bar |
| `app.config.js` | pulls its entry from `apps/registry.js` |
| `index.html`    | links `../base.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

## notes

OPFS has no atomic move, so a rename is a copy followed by a delete — for a
directory that means walking it and rebuilding it entry by entry (`fs.js`).
Browsers that don't expose OPFS get a friendly "no private storage" screen
instead of a broken page.
