# apps/videos

web: https://zugriff.dev/apps/videos

A local video app with three routes, switched by `?mode=` through the shared
query-param router (`.shared/js/app/router.js`, bound to `app.state.route`):

- **Library** (`?mode=library`) — a video-manager. Grant folders off your device
  with the File System Access API and browse them as galleries; open any clip
  into the player. Only the folder permission is remembered — nothing is
  uploaded. Clips show as an icon for now; poster frames are a follow-up. Data
  layer: [`library.js`](./library.js) over the shared `FolderLibrary`.
- **Player** (`?mode=player`) — the shared video engine
  ([`.shared/js/media/videoplayer.js`](../../.shared/js/media/videoplayer.js)):
  play/pause, seek, frame-step, reverse, loop, and the live transforms (aspect,
  crop-to-fill, mirror, rotate). The standalone [`videoplayer`](../videoplayer)
  app renders the same engine with its own chrome.
- **Edit** (`?mode=edit`) — a hint only. The plan is quick clip edits (trim/cut,
  rotate, flip, crop, speed, mute) baked into an exported clip — not an NLE.

## Structure

| file | what it is |
|------|------------|
| `app.js`            | shell: mode bar + router outlet + launchQueue |
| `context.js`        | the shared app handle (`zugriff.app('videos')`) |
| `library.js`        | granted-folder data layer (clip records) |
| `routes/index.js`   | the route table (id + nav metadata + component) |
| `routes/*.js`       | library / player / edit routes |

The player state lives at module scope in the shared engine, so a page has one
player instance; the library hands it a clip via `loadFile()` and navigates.
