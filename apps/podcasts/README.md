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
- **episodes per podcast** — sorted newest, oldest or A–Z, with a sticky filter.
- **episode page** — a full view for a single episode: artwork, complete
  description, playback controls and progress.
- **filter** — the latest-episodes stream and each podcast page carry a
  bottom-docked search that filters as you type.
- **listen later** — a bookmark list of episodes to get to.
- **progress & done** — the player saves your position as you listen and marks
  an episode done at ~95%; you can also toggle done by hand.
- **layout** — the menu (top / bottom / left / right) and the player
  (top / bottom) positions are set in Settings; the menu defaults to the bottom.
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
- Artwork is downscaled and cached on-device — no image third party. Covers are
  frequently 1400–3000px but shown at 48–160px, so the shared thumbnail cache
  (`shared/js/lib/thumbs.js`) fetches each image once, shrinks it to a small
  webp on a canvas and stores the blob in IndexedDB; from then on the original
  host is never touched again. The byte fetch is direct first and only falls
  back to the CORS proxy when an image host blocks it. While a thumbnail is
  generating a placeholder shows; if it can't be made the original is shown for
  display, then a placeholder — so the full-size image is downloaded at most
  once and never rendered at full size on the happy path.
- Audio streams from the podcast's own host; only feed metadata is stored
  locally, not the audio.
