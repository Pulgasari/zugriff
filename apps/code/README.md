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
| Monaco from esm.sh                                  | unchanged — imported by full URL (see below)        |

## Monaco

Monaco is a large, self-contained bundle with its own (preact-free) world, so it
is imported straight from esm.sh by full URL in `components/Editor.js` rather than
through the shared import map (which pins the app's single preact copy). Its
stylesheet is linked from `index.html`. Editor themes are the
[monaco-themes](https://github.com/brijeshb42/monaco-themes) set, fetched on
demand and cached.

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

## still stubbed

`Browser` (a preview pane), `Plugins` and `Workspaces` are placeholders, exactly
as they were upstream — the app is advanced but not finished.
