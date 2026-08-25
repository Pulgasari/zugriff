# apps/file-explorer

A file explorer over a folder from your **own disk**. You grant one folder with
the [File System Access API](./../../shared/js/lib/fsaccess.js) and it becomes
the root of the explorer — browse the tree, preview files, download them back
out. Nothing is uploaded and nothing is copied; only the directory handle is
persisted, and only so we can re-ask for it on the next visit.

## what it does

- **grant a folder** — it becomes the root; the handle is remembered (in one
  `@bunker/db` store) so a returning visit just re-asks for permission
- browse the directory tree — double-click a folder to open it, breadcrumb or
  `Backspace` to go back, list and grid views, a live filter
- a details panel with inline previews — images render, small text files show
  their contents — and **download** any file
- **change** the granted folder or **close** it (which only forgets the handle)

Browsing is read-only for now (the folder is picked with `mode:'read'`) — this
is the “grant a folder as root” sketch; granting write is a later step.

## how it's built

This is an *app*, not a *tool*: it draws its own chrome and brings its own css
(`app.css` over `apps/base.css`), instead of the tools' `Shell` and
`shared/css/index.css`. It still shares the theme tokens, the import map, the
aufbau runtime and the service worker with the rest of zugriff.

The browsing surface itself is the shared
[`FileExplorer`](./../../shared/js/components/FileExplorer.js) component. This
app only builds a *backend* around the granted folder and hands it to the
component; the same component, over `dirfs.js`'s `opfsBackend`, browses the
private OPFS the cli uses. So the OPFS browser this app used to be now lives as
a reusable component any app can embed.

| file            | what it is |
|-----------------|------------|
| `app.js`        | the app chrome — sidebar + welcome/reconnect screens — around `<${FileExplorer}>` |
| `db.js`         | persists the one granted root handle (`@bunker/db`) + the permission dance |
| `app.css`       | the app's own look — sidebar and hero screens only |
| `index.html`    | links `../base.css` + `shared/css/explorer.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest (generated from the registry) |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

The explorer engine lives in `shared/`:

- [`shared/js/components/FileExplorer.js`](./../../shared/js/components/FileExplorer.js) — the UI
- [`shared/css/explorer.css`](./../../shared/css/explorer.css) — its look (scoped under `.fx`)
- [`shared/js/lib/dirfs.js`](./../../shared/js/lib/dirfs.js) — directory-tree ops over any `FileSystemDirectoryHandle` root, plus the ready-made `opfsBackend`

## notes

Folder permissions don't survive a plain reload in every browser, so the app
nudges you to **install** it — an installed PWA keeps the grant (“allow on every
visit”). Browsers without the File System Access API get a friendly
“can't open folders here” screen instead of a broken page.
