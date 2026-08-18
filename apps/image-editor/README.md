# apps/image-editor

A canvas image editor for the browser. Open a picture and **crop, rotate, flip,
resize and adjust** it, then export — everything runs on the device, the image
is never uploaded anywhere.

## what it does

- **open** an image (button, or drag-and-drop onto the stage)
- **crop** with an interactive rule-of-thirds box (drag the body to move, the
  handles to resize)
- **rotate** in 90° steps, **flip** horizontally or vertically
- **resize** with an optional aspect-ratio lock
- **adjust** brightness, contrast, saturation and grayscale (live preview)
- **undo / redo** every geometry step (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) and
  **reset** back to the original
- **export** as PNG, JPEG or WebP, with a quality slider for the lossy formats

## how it's built

An *app*, not a *tool*: it draws its own chrome and brings its own css
(`app.css` over `apps/base.css`) instead of the tools' `Shell` and
`shared/css/index.css`, and boots with `shell: false`.

| file            | what it is |
|-----------------|------------|
| `app.js`        | the editor UI (preact + htm + signals), booted with `shell: false` |
| `edit.js`       | the pixel work — pure canvas transforms (rotate/flip/crop/resize/filter/io), each returns a new canvas so the old one can go on the undo stack |
| `app.css`       | the app's own look — toolbar, stage, side panel, status bar |
| `app.config.js` | pulls its entry from `apps/registry.js` |
| `index.html`    | links `../base.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

## notes

Adjustments are kept as live sliders and only baked into the pixels on export
(via a canvas `filter`), so they stay non-destructive and reversible. Geometry
operations bake immediately and go on the undo stack. Decoding prefers
`createImageBitmap` and falls back to an `<img>` for older browsers.
