# apps/videoplayer

A phone-first player for a single video off the device. No library, no storage —
pick a file, play it, and reach for the transform row when a clip is the wrong
way round. The file never leaves the page (it plays from a local object URL).

## What it does

- **Open a video** — a hidden `<input type="file" accept="video/*">`, the same
  mobile-friendly path the other apps use. The OS picker hands over a file; it
  plays from an object URL and the disk is never touched again.
- **Transport** (top control row) — play/pause, skip ±10s, and step a single
  frame either way (frame stepping assumes ~30fps; `<video>` exposes no real
  frame rate).
- **Transforms** (bottom control row):
  - **Loop** — native forward loop; the reverse drive loops too.
  - **Aspect ratio** — cycles the frame between native, 9:16, 16:9, 1:1 and 4:3.
  - **Crop to fill** — toggles `object-fit` between `contain` (letterboxed) and
    `cover` (fills the frame, cutting the overflow). Aspect 9:16 + crop is how a
    16:9 clip is forced into a portrait frame with the sides cut off.
  - **Reverse** — best-effort backwards playback. `<video>` has no reliable
    reverse, so this walks `currentTime` down on a rAF loop; the browser shows
    the frames it can seek to.
  - **Mirror** — horizontal flip (`scaleX(-1)`).
  - **Rotate** — 90° at a time.
- **Scrubber** — between the two rows, with current / total time.
- **Double-tap the stage** — folds all chrome away (and back), so the video goes
  edge to edge. A single tap is deliberately left alone so it can't fight the
  transport buttons.
- **Settings** — the gear opens a prepared, empty panel; playback and gesture
  settings will land there.

## Files

| file            | what it is |
|-----------------|------------|
| `index.html`    | static shell — links `../base.css`, `app.css` and the importmap |
| `app.js`        | the player — state, playback, transforms, mounted via `boot({ shell:false })` |
| `app.config.js` | registry entry + aufbau runtime options |
| `app.css`       | the app's own look — topbar, stage, two-row control deck |
| `manifest.json` | pwa manifest — **generated** from the registry, don't hand-edit |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon — the source the `assets/` PNGs are rasterised from |

## Not yet

- The **settings** panel is a stub.
- **File Handling API** (`file_handlers` in the manifest + `launchQueue`) would
  let the OS open a video *with* the installed app; a natural next step.
- Rotation at 90°/270° doesn't re-fit the frame to the rotated video yet.
