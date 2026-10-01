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

## tasks

Work that takes a while runs as a task (`modules/tasks.js`), never in front of
the user: reading the folder, every write. Tasks wait in lanes: the index and
the writes run side by side, two writes one after another. The square beside
the search field turns while one runs and shows the count; a tap lists what
runs, what waits and what ran (the last 50, kept across visits). A waiting or
running task can be cancelled.

## copy and move

An entry's details put it on the clipboard, to copy or to move; more entries
of the same kind join it. In the library a bar shows what waits, and pastes it
into the folder on screen as one task with a file count as progress
(`modules/transfer.js`). A taken name gets a number (`a (2).txt`), a folder
cannot go into itself. A move uses the browser's own `move()` where it has
one, else copy and delete. Files are copied as streams.

## send (lan)

The `sync` view (`#/sync`, in the menu as Send) sends files to a device on the
local network over LocalSend v2: any LocalSend app receives them, or the node
desktop daemon of the original filesync (`pulgasari/wallpaperfx`). It needs the
android app: the network part is the native FileSync plugin
(`.github/capacitor/plugins/filesync/`, protocol in its `PROTOCOL.md`), only
the files app carries it (`build.plugins` in the registry).

- receivers are found by multicast, typed (`ip:port`, `filesync://…`) or picked
  from those sent to before; https certificates are pinned by fingerprint where
  it is known, a pin is asked for when the receiver wants one
- files are picked, or sent from the library: a file's details have "send",
  through the `content://` uri its android handle carries
- a send is a task in the `send` lane, with bytes as progress; its history is
  the task history
- auto sync sends a folder in the background whenever new files show up on
  wi-fi (optionally one ssid), subfolders included

## folder types and bookmarks

`modules/places.js`, per granted folder:

- **types**: Audio, Documents, Images and Videos built in, more with a name and
  an icon. A folder's details suggest one when most of its files are of a
  kind. For now a type changes the folder's icon; a default view per type is
  the next step.
- **bookmarks**: a folder is bookmarked from its details and shows on the
  dashboard.

## remote

WebDAV servers (Nextcloud and ownCloud included) are connected from the
dashboard and open in a tab of their own (`modules/remotes.js`). A connection
is a root handle like the granted folder (`.shared/js/modules/webdav/`), so
browsing, preview, thumbnails, copy and move all work on it, and between it and
the folder. The server has to allow cors for this app. The credentials stay on
the device, in opfs. Drive, (S)FTP and LAN are tiles that say what each would
need.

## writing

The folder is granted read only. Renaming, deleting and a new folder ask for
write access on the click that wants it.

## how it's built

| file              | what it is |
|-------------------|------------|
| `app.js`          | the app: state, tabs, the views, the areas |
| `modules/db.js`   | the one granted folder handle (`@bunker/db`) and the permission dance |
| `modules/places.js` | bookmarks and folder types |
| `modules/remotes.js` | the webdav connections |
| `modules/scan.js` | the index of the whole folder |
| `modules/sync.js` | lan sending through the FileSync plugin |
| `modules/tasks.js` | the task lanes and their history |
| `modules/transfer.js` | the clipboard, copying and moving |
| `views/sync.js` | the send view |
| `app.css`         | the views' layout and the look of rows, tiles and cards |
