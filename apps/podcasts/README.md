# podcasts

A podcast client that runs entirely on the device. Subscribe by RSS feed URL,
play episodes with a docked player, and keep progress, done-marks and a
listen-later list — all stored locally, nothing leaves the browser except the
feed requests themselves.

## what it does

- **subscribe by RSS** — paste a feed URL; RSS 2.0 and Atom are both parsed.
- **latest episodes** — a combined, newest-first stream across every subscription.
- **podcasts view** — grid or list, sorted alphabetically or by most recently
  updated (the feed with the newest episode first).
- **episodes per podcast** — sorted newest, oldest or A–Z.
- **listen later** — a bookmark list of episodes to get to.
- **progress & done** — the player saves your position as you listen and marks
  an episode done at ~95%; you can also toggle done by hand.
- **import / export** — back up your subscriptions and listening state as JSON
  and restore them on another device.

## under the hood

Everything is a static ES module — no build step, in keeping with the rest of
zugriff.

- **`db.js`** — the storage layer over [`@bunker/db`](https://github.com/pulgasari/bunker/)
  (IndexedDB). Three tables — `podcasts`, `episodes`, `state` — mirrored into
  three preact signals so the whole UI stays reactive. Episode keys start with
  their podcast id, so "all episodes of this podcast" is a plain prefix scan.
- **`feed.js`** — fetches and parses feeds in the browser. Podcast feeds rarely
  send CORS headers, so it tries a direct request first and falls back to a
  CORS proxy whose URL you set in **Settings** (`{url}` is replaced with the
  feed URL; clear it for direct-only).
- **`player.js`** — one `<audio>` element lifted out of the component tree so it
  survives navigation, with its state mirrored into signals and the position
  written back to the db as it plays.
- **`app.js`** — the UI: a fixed sidebar, a scrolling main column and the docked
  player, all drawn by the app itself (`boot({ shell: false })`). The
  grid/list podcasts view is laid out by `<aufbau-index viewmode="grid|list">`
  with each podcast in an `<aufbau-item>`.

## notes

- Feeds load through the configured CORS proxy by default (`api.allorigins.win`).
  Change or clear it in Settings if you'd rather use your own.
- Audio streams from the podcast's own host; only feed metadata is stored
  locally, not the audio.
