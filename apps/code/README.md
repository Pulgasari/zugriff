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

## files

| file                     | what it is |
|--------------------------|------------|
| `index.html`             | static shell — base css, Monaco css, the import map |
| `app.js`                 | boot, the top-level layout, the app-wide effects |
| `state.js`               | the shared app object — config, open files, modal, dispatch |
| `editor.js`              | Monaco options (persisted) + the theme loader |
| `commands.js`            | the command registry (palette / dock / toolbar) |
| `fs.js`                  | the granted workspace root, stored via `@bunker/db` |
| `icons.js`               | the editor's short icon aliases → iconify ids |
| `components/`            | the UI (Editor, Keyboard, Dock, Statusbar, FileBrowser, …) |
| `app.css`                | the editor's own look |
| `app.svg` / `manifest.json` / `assets/` | icon + pwa manifest (generated from the registry + `app.svg`) |

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
- files carry a `source` (`'local'` | `'github'`) and a stable `id` (the FS
  handle, or `gh:owner/repo@branch:path`) so the tabs/editor match records
  regardless of source. **Save** dispatches on `source`: local → a FS writable,
  GitHub → a `PUT contents` commit (`state.saveActiveFile`).

A one-click OAuth login can be added later with a tiny CORS relay (device flow);
the app side wouldn't change.

## still stubbed

`Browser` (a preview pane), `Plugins` and `Workspaces` are placeholders, exactly
as they were upstream — the app is advanced but not finished.
