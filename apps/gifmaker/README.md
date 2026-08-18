# apps/gifmaker

Turn a stack of images into an animation. Load a bunch of pictures, reorder /
remove / add more, nudge each frame's position a few pixels at a time, play it
back, and export — as an animated **GIF**, or as a **project zip** you can
reimport later to keep editing. Everything runs on the device; nothing is
uploaded.

> The name is a placeholder — it does frame-by-frame sequences generally, not
> only GIFs.

## what it does

- **load** many images at once (button or drag-and-drop)
- **reorder** frames by dragging their thumbnails, **remove** one with its ×,
  **add** more at any time
- **nudge** the selected frame — arrow-pad buttons, X/Y number fields, or the
  arrow keys (a configurable step, e.g. "left −5px"; hold Shift for 1px)
- **play** it back (space bar), with per-frame delays and a default delay
- **double-tap the canvas** to hide the whole interface and just watch it play
  (double-tap again, or `Esc`, to bring it back)
- pick the **canvas size** (auto = largest frame, or custom) and a **background**
- **export as GIF** (via `gifenc`, loaded on demand)
- **export a project `.zip`** — the original PNGs plus a `project.json` manifest
  (order, offsets, delays, canvas, background) — and **import** one back to
  resume, view and play

## how it's built

An *app*, not a *tool*: own chrome and own css (`app.css` over `apps/base.css`),
booted with `shell: false`.

| file            | what it is |
|-----------------|------------|
| `app.js`        | the UI (preact + htm + signals): toolbar · stage + panel · filmstrip · status |
| `zip.js`        | a tiny dependency-free ZIP reader/writer (store on write; store + deflate on read via `DecompressionStream`) |
| `app.css`       | the app's own look |
| `app.config.js` | pulls its entry from `apps/registry.js` |
| `index.html`    | links `../base.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

## notes

The GIF encoder (`gifenc`) is added to the shared import map and imported
lazily inside the export path, so it is only fetched when you actually export a
GIF. Frames are composited onto the chosen background colour before encoding.
The project zip stores the untouched originals, so re-importing loses nothing.
