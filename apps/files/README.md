# files

A file manager over a folder from your **own disk**. You grant one folder with
the File System Access API and it becomes the root. Nothing is uploaded and
nothing is copied, only the directory handle is kept, so a returning visit just
asks for permission again.

## frame

An `<app-root>` with four `<app-area>`s (`@aufbau/components`):

| area      | dock   | what it holds |
|-----------|--------|---------------|
| `main`    |        | the views |
| `menu`    | start  | the app's menu, the former tools come back here |
| `config`  | end    | the settings: the shared ones and the app's own, the folder |
| `context` | bottom | about the current thing: an entry, the open file, the folder, the scan |

On a narrow screen the docked areas are drawers, `context` peeks with its
handle. On a wide one they are sidebars and a sheet below the views.

## views

| view        | route        | what it is |
|-------------|--------------|------------|
| `dashboard` | `#/`         | recent files, categories, the folder; a search over the whole folder |
| `library`   | `#/library`  | the folder in tabs: crumbs, filter, list or grid, a new-folder button |
| `preview`   | `#/preview`  | one file, an image inline. its details are in the context area |

## settings

- **Open with**: `auto` (a tap on touch screens, a double click with a mouse),
  `a tap`, `a double click`
- **Search bar**, **Tabs**: at the bottom (default) or the top

## the index

The dashboard reads the whole folder in the background (`modules/scan.js`):
size, type and date of every file, dot folders and `node_modules` skipped. The
last index is stored in opfs and shown at once on the next visit, a fresh walk
replaces it when it is done.

## thumbnails

Images get a thumbnail once they scroll into view: decoded, downscaled to 256px
and stored as webp in opfs by the shared thumbnail cache (`.shared/js/thumbs.js`,
`requestFile`). The key holds path, size and modification time, so an edited
image gets a new one. The cache is capped at 128 MB, the oldest go first.

## writing

The folder is granted read only. Renaming, deleting and a new folder ask for
write access on the click that wants it.

## how it's built

| file              | what it is |
|-------------------|------------|
| `app.js`          | the app: state, tabs, the views, the areas |
| `modules/db.js`   | the one granted folder handle (`@bunker/db`) and the permission dance |
| `modules/scan.js` | the index of the whole folder |
| `app.css`         | the views' layout and the look of rows, tiles and cards |
