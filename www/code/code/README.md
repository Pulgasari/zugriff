# apps/code

a mobile-first **code editor** — the port of *ratcode* (originally a PHP + Preact
app) onto zugriff's static app shell. grant a folder from your device and edit
its files with Monaco, a screen keyboard tuned for coding, a command palette and
a file tree — everything runs on device, nothing is uploaded.

## how the migration maps

| ratcode (server)                                   | here (static app)                                   |
|----------------------------------------------------|-----------------------------------------------------|
| `app.php` template + cookie theme                  | `index.html` + shared `boot()` + a `stored()` theme |
| service worker that auto-injected imports          | plain es-module imports in every file               |
| `preact-x` `signalWithCookie` / `signalWithStorage`| shared `stored()` (`shared/js/lib/signals.js`)      |
| `preact-x` `deepSignalWithStorage` (editor config) | one `stored()` object + immutable update helpers    |
| internal `bunker.js` build (`db.workspace.*`)      | `@bunker/db` `createDb` (`fs.js`)                    |
| `iconify-icon` custom element                      | shared `<Icon>` (`aufbau-icon`) via a local alias map|
| Monaco from esm.sh                                  | Monaco via its AMD loader on a CDN (see below)      |

## Monaco

Monaco is loaded through `monaco.js` — its own AMD loader from a versioned CDN,
**not** the shared import map. esm.sh's `monaco-editor@x/…?worker` builds are
broken (`QE is not a function` in ts.worker) and the shared service worker chokes
on esm.sh's streaming responses ("body is locked"); the `min/vs` AMD layout ships
plain worker scripts that cache cleanly. Workers are wired through a same-origin
blob that `importScripts` the CDN worker (workers can't be cross-origin). The
loader also injects Monaco's stylesheet, so `index.html` links none. Editor themes
are the [monaco-themes](https://github.com/brijeshb42/monaco-themes) set, fetched
on demand and cached.

## icons

Never put a `display` rule on `.icon`: `<aufbau-icon>` is a masked box that sizes
itself from `inline-size`/`block-size`, and forcing `display: inline` makes it
ignore both and collapse to nothing (the Tap wrappers are `inline-flex` boxes so
the icon inside is blockified and keeps its size).

## runtime / the app object

the app runs on the shared **global runtime**: the page is the unified
`zugriff/index.html`, whose `<head>` blocking `boot.js` injects the import map + theme
colours and binds `zugriff` (and `zugriff.app` for this route) to `window`; the mount
script then awaits the runtime and imports the route's `app.js`. so nothing here imports the runtime — `zugriff` and `zugriff.app`
are the always-present reference points (see `.shared/js/runtime.js`, `.shared/js/app.js`).

`app.js` assembles the app on that handle:

```
app                        the handle (zugriff.app)
app.state                  reactive base (@aufbau/signals deep signal)
app.state.theme/font/…     shared leaves from the registry (theme drives applyTheme)
app.state.config           chrome / panel prefs        (persisted, app.persist('config'))
app.state.editor           monaco construction options (persisted, app.persist('editor'))
app.state.modal            active overlay id | null    (ephemeral)
app.commands               the command registry (Map<id,{ exec }>)
app.editor                 monaco behaviour — config view over app.state.editor, theme, instance
app.files                  open tabs (open/active) + open/save/close ops
app.workspaces             the sources: local fs + github + tree clipboard/version
```

state is extended by assigning onto `app.state` and wiring effects with `app.effect`;
durable subtrees hydrate + persist through `app.persist`. `app.state.editor` is the
data, `app.editor` the behaviour over it (the bridge). modules are hung directly on the
handle (`app.commands = …`) and reach each other through the `zugriff.app` global, so
there is no import cycle; `app.module()` / `app.component()` load app-relative modules
and components on demand.

## files

| path                     | what it is |
|--------------------------|------------|
| `app.js`                 | assembles the handle: state, modules, effects, layout, mount |
| `modules/config.js`      | chrome / panel prefs (defaults seeded onto `app.state.config`) |
| `modules/editor.js`      | Monaco options view over `app.state.editor` + the theme loader |
| `modules/commands.js`    | the command registry (palette / dock / toolbar) |
| `modules/files.js`       | the open documents — tabs, active, open/save/close |
| `modules/workspaces.js`  | the editable sources: local fs + github + tree clipboard/version |
| `modules/fs.js`          | the granted workspace root, stored via `@bunker/db` |
| `modules/github.js`      | the in-browser GitHub client |
| `modules/keyboard.js`    | native (Android) keyboard suppression |
| `modules/{db,fsops,treeops,monaco}.js` | idb, local file ops, tree helpers, the Monaco loader |
| `components/`            | the UI (Editor, Keyboard, Dock, Statusbar, FileBrowser, …) |
| `app.css`                | the editor's own look |
| `app.svg` / `manifest.json` / `assets/` | icon + pwa manifest (generated from the registry + `app.svg`) |

the page is the shared `zugriff/index.html` (one shell for the launcher and every app
route); there is no per-app `index.html`.

## GitHub

The app edits two kinds of source: a **local folder** (File System Access) and a
**GitHub repo** (the dock's GitHub tap). GitHub runs entirely in the browser
against `api.github.com` (which sends CORS headers) — the only thing a static
page can't do is the OAuth token exchange (needs a secret / a backend), so v1
authenticates with a **fine-grained Personal Access Token** the user pastes in
(scope: *Contents — read and write* on the chosen repos). The token lives in
IndexedDB (`db.js` → `auth` store) and is sent only to GitHub.

- `github.js` — the API client + connection signals (token, user, repos, repo,
  branch). Tree is fetched one level at a time (`git/trees/{sha}`, non-recursive)
  so huge repos stay cheap; blobs are read via `git/blobs`, binary blobs open
  read-only.
- `components/GitHub.js` / `GitHubTree.js` — the connect + browse modal.
- files carry a `source` (`'local'` | `'github'` | `'webdav'`) and a stable `id`
  (the FS handle, `gh:owner/repo@branch:path`, or `dav:<connId>:<path>`) so the
  tabs/editor match records regardless of source. **Save** dispatches on `source`
  (`modules/files.js`): local → a FS writable, GitHub → a `PUT contents` commit,
  WebDAV → a `PUT`.

Saving a GitHub file commits it. By default the commit message is `Update <path>`;
turn on **Settings → GitHub → Prompt for commit message** to be asked each time
(shared `openPrompt`). A one-click OAuth login can be added later with a tiny CORS
relay (device flow); the app side wouldn't change.

## WebDAV

The third source is a **WebDAV** server (the dock's cloud tap). It runs entirely
in the browser over `fetch` — PROPFIND to list, GET/PUT to read/write,
MKCOL/DELETE/MOVE/COPY for the tree ops — with HTTP Basic auth. Connections (incl.
the password) live in IndexedDB (`db.js` → `webdav` store) and are sent only to
their server; prefer an app-password where the server offers one.

**Direct only — no proxy.** The browser talks to the server straight, so the
server MUST send CORS headers (`Access-Control-Allow-Origin` for this origin, and
allow the WebDAV methods + `Authorization` / `Depth` / `Destination`). That covers
a self-hosted **Nextcloud/ownCloud** with CORS enabled, an `rclone serve webdav
--cors`, or a caddy/nginx that injects the headers. It is **not** a key to Google
Drive / Dropbox / OneDrive — those speak their own OAuth APIs, not WebDAV, and
still need registered client IDs + a backend for the token exchange (deferred).

- `modules/webdav.js` — the client + connection signals (connections, active).
  `webdav.list()` returns full relative paths, so the tree needs no prefix
  threading; a NUL byte in a blob opens it read-only.
- `components/WebDAV.js` / `WebDAVTree.js` — the connect + browse modal.

(S)FTP stays deferred: the browser has no raw TCP/SSH, so it needs a stateful
gateway (a backend). WebDAV is the browser-native substitute for "edit files on my
server".

## file & folder operations

All three trees carry a `⋯` row menu (and a root toolbar) with **New File / New
Folder / Rename / Delete / Cut / Copy / Paste** — see `RowMenu.js` and the
per-source ops:

- local (`modules/fsops.js`): File System Access; rename/move use the native
  `FileSystemHandle.move()` where present, else a recursive copy + delete.
- GitHub (`modules/github.js`): each change is a **single commit** through the Git
  Data API — rename/move/copy reuse the existing blob shas, folder delete/rename
  walk the recursive tree. New folders are a `.gitkeep`.
- WebDAV (`modules/webdav.js`): each change is a **single request** — MKCOL / PUT /
  DELETE / MOVE / COPY; a collection deletes recursively.

`modules/treeops.js` holds the shared bits: a one-slot cut/copy **clipboard**
(same-source — for GitHub same-repo+branch, for WebDAV same-connection) and a
per-source **version** signal that bumps after every change so the tree refreshes
(local reloads in place; GitHub/WebDAV reload from the root). Renaming or deleting
an open file closes its now-stale tab.

## still stubbed

`Browser` (a preview pane), `Plugins` and `Workspaces` are placeholders, exactly
as they were upstream — the app is advanced but not finished.
