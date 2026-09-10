# podcasts

A podcast client that runs entirely on the device.

Subscribe by RSS feed URL, play episodes with a docked player, and keep progress, done-marks and a listen-later list — all stored locally, nothing leaves the browser except the feed requests themselves.

## features

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

## planned features
- [ ] download episodes
- [ ] sync subscriptions

---

# under the hood

Everything is a static ES module — no build step, in keeping with the rest of
zugriff. The app runs on the shared **global runtime**: the page is the unified
`zugriff/index.html`, whose blocking `boot.js` binds `zugriff` (and `zugriff.app`,
`html`) to `window`, so nothing here imports the runtime — `zugriff.app` is the
reference point (see `.shared/js/app.js`).

## structure

```
app.js         assembles the handle: modules, state, actions, hotkeys, mount
modules/       app logic — db, player, feed, methods (pure helpers)
views/         routed main content — Latest, Podcasts, PodcastDetail, EpisodeDetail, Saved
panels/        chrome + overlays — Sidebar, Player, Search dock, Settings
dialogs/       modal dialogs — Add podcast
components/    small reusable pieces — Artwork, PodcastsIndex, EpisodesIndex, …
```

`app.js` hangs the modules on the handle and seeds the state:

- `app.db` / `app.player` / `app.thumbs` — the modules (their own preact signals; read
  with `.value`).
- `app.state` — the app's ephemeral ui state on the shared deep signal (`@aufbau/signals`),
  read/written **without** `.value`: `route` (`{name,id}`), `search`, `dialog`, `busy`.
  Leaves are read inside render to stay reactive, so they are never destructured at module
  top. Nothing here persists.
- `app.settings` — the durable prefs as a typed, `.value`-free store (`typedSignal`):
  `podcastSort` / `episodeSort` / `view` / `menuPos` / `playerPos` are enum leaves (off-list
  writes are ignored), `proxy` / `imgResizer` are text. Persisted as one blob under
  `zugriff:podcasts:settings`. Its own store rather than an `app.state` subtree because
  `typedSignal` persistence is whole-store and `app.state` must stay ephemeral.
- `app.go(name, id)` — navigate. For toasts call `app.toast(…)` directly (see `.shared/js/modules/toast.js`).
- `app.actions` — named behaviours (`refresh-all`, `add-podcast`, `toggle-play`, `skip-back/forward`, …); `app.hotKeys` is the declarative combo→spec map that binds keys to them (`space` = play/pause, `arrow-left`/`arrow-right` = skip, `escape` = close). See `.shared/js/modules/{actions,hotkeys}.js`.

Views/panels/components reach all of this through `const app = zugriff.app` (+
destructuring the stable module refs); shared components load from
`/.shared/js/components`, app pieces through `app.view()` / `app.panel()` /
`app.dialog()` / `app.component()`.

## modules

- **`modules/db.js`** — the storage layer over [`@bunker/db`](https://github.com/pulgasari/bunker/)
  (IndexedDB). Three tables — `podcasts`, `episodes`, `state` — mirrored into
  preact signals so the whole UI stays reactive. Episode keys start with their
  podcast id, so "all episodes of this podcast" is a plain prefix scan.
- **`modules/feed.js`** — fetches and parses feeds in the browser. Podcast feeds
  rarely send CORS headers, so it tries a direct request first and falls back to
  a CORS proxy whose URL you set in **Settings**.
- **`modules/player.js`** — one `<audio>` element lifted out of the component
  tree so it survives navigation, with the position written back to the db as it
  plays. its state is held in signals internally but the public surface
  (`app.player`) is a `.value`-free facade of getters + methods: `app.player.episode`,
  `.time`, `.duration`, `.isPlaying` / `.isWaiting` / `.status`, and `play()` /
  `toggle()` / `close()` / `skip()` / `setRate()`.
- **`modules/methods.js`** — pure view helpers (formatting, html→text, the
  list filters/sorts).

The grid/list podcasts view is laid out by `<aufbau-index viewmode="grid|list">`
with each podcast in an `<aufbau-item>`.

---

# notes

- Feeds load through the configured CORS proxy by default (`api.allorigins.win`).
  Change or clear it in Settings if you'd rather use your own.
- Artwork is downscaled by a self-hosted resizer — no third party. Covers are
  frequently 1400–3000px but shown at 48–160px, so each image goes through
  `img.pulgasari.dev` (see [`/img-proxy`](./../../img-proxy/)), a tiny PHP
  endpoint that fetches the original server-side (no browser CORS) and returns a
  small webp. The shared cache (`.shared/js/thumbs.js`) stores that result in
  IndexedDB, so from then on nothing is fetched again. While it loads a
  placeholder shows; if the resizer is unreachable the original is shown for
  display, then a placeholder. The endpoint is set in **Settings → Artwork
  resizer**; clear it to resize in the browser instead (works only for hosts
  that allow cross-origin reads).
- Audio streams from the podcast's own host; only feed metadata is stored
  locally, not the audio.
