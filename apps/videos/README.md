# apps/videos

web: https://zugriff.dev/apps/videos

A local video app with three modes, the views of `#app` (the `<app-root>`), at
`#/`, `#/player` and `#/edit`:

- **Library** (`#/`) — a video-manager. Grant folders off your device
  with the File System Access API and browse them as galleries; open any clip
  into the player. Only the folder permission is remembered — nothing is
  uploaded. Each clip shows a poster frame decoded on device (lazy as the cell
  nears the viewport, then cached in IndexedDB via `.shared/js/media/poster.js`);
  a clip the browser can't decode falls back to an icon. Data
  layer: [`modules/library.js`](./modules/library.js) over the shared `FolderLibrary`.
- **Player** (`#/player`) — the shared video engine
  ([`.shared/js/media/videoplayer.js`](../../.shared/js/media/videoplayer.js)):
  play/pause, seek, frame-step, reverse, loop, and the live transforms (aspect,
  crop-to-fill, mirror, rotate). The standalone [`videoplayer`](../videoplayer)
  app renders the same engine with its own chrome.
- **Edit** (`#/edit`) — a hint only. The plan is quick clip edits (trim/cut,
  rotate, flip, crop, speed, mute) baked into an exported clip — not an NLE.

## Structure

| file | what it is |
|------|------------|
| `app.js`             | the areas of `#app`: mode bar + a view per mode, config; launchQueue, binds `app.lib` |
| `modules/library.js` | granted-folder data layer (clip records) |
| `views/index.js`     | the modes (id, nav label and icon, view)        |
| `views/*.js`         | library / player / edit modes  |

The player state lives at module scope in the shared engine, so a page has one
player instance; the library hands it a clip via `loadFile()` and navigates.
