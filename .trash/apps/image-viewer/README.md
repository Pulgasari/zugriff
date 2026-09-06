# apps/image-viewer

A plain image viewer. The point is the *entry* path: an installed copy registers
as a **file handler**, so on Android — and desktop — you can **“open with →
Viewer”** straight from a gallery or file manager. It also takes images from a
picker and from drag-and-drop. Nothing is uploaded; the images live only as
object URLs for the life of the tab.

## what it does

- **open with** — the installed PWA appears in the OS “open with” list; the
  launched files arrive through the File Handling API's `launchQueue`
- open images with the picker (`showOpenFilePicker`, with an `<input>` fallback)
  or by dropping them anywhere on the window
- fit-to-screen by default; **zoom** (buttons, wheel, double-click) and **pan**
  (drag when zoomed), plus **pinch-to-zoom** on touch
- multiple images at once — prev/next (arrows, swipe-less on-screen buttons,
  `←`/`→`), a counter and a thumbnail strip
- fullscreen and an immersive mode (`hide chrome`, tap to restore); download the
  current image back out

## how it's built

This is an *app*, not a *tool*: it draws its own chrome and brings its own css
(`app.css` over `apps/base.css`). No persistence and no `@bunker/db` — a viewer
has nothing durable to keep.

The “open with” wiring is two halves:

- the **manifest** declares `file_handlers` + `launch_handler`. Those aren't part
  of the shared manifest shape, so they're declared under `manifest:` in the
  app's `shared/js/registry.js` entry and
  [`.github/scripts/gen-app-assets.mjs`](./../../.github/scripts/gen-app-assets.mjs) passes them
  through when it generates `manifest.json`.
- `app.js` reads `window.launchQueue.setConsumer(...)` on boot; each launched
  file is a `FileSystemFileHandle`, so `handle.getFile()` gives the `File`.

| file            | what it is |
|-----------------|------------|
| `app.js`        | the viewer — launchQueue + picker + drop, zoom/pan/pinch, multi-image nav |
| `app.css`       | the app's own look — top bar, stage, thumbnail strip |
| `index.html`    | links `../base.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest, incl. the file-handling members (generated from the registry) |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

## notes

File handling needs the app **installed** and a browser that supports the File
Handling API (Chromium on Android and desktop today). Everywhere else the picker
and drag-and-drop still work; the viewer just won't show up in “open with”.
