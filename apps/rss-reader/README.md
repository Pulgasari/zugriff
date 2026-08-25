# apps/rss-reader

A feed reader that runs entirely on the device. Follow RSS/Atom feeds, skim the
**latest across all** of them or **per channel**, and click through to the
original — nothing is embedded or reader-mode'd, reading happens on the source
site. **YouTube** channels get their own department: paste a channel URL or
`@handle` and its videos show up as cards in a separate section.

## what it does

- **add feeds** by URL (feed or site) — and YouTube channels by channel URL,
  `@handle`, or even a video link; the channel is resolved to its RSS feed
- **Latest** — every article feed's newest entries in one list; **YouTube** — the
  same for video feeds, as a thumbnail grid; plus a per-feed view for each
- unread dots and per-feed unread counts; opening an entry (or “mark all read”)
  clears them
- pull-to-nothing: a **refresh** re-fetches feeds; stale feeds also refresh
  quietly on load

## how it's built

This is an *app*, not a *tool*: own chrome, own css (`app.css` over
`apps/base.css`).

| file            | what it is |
|-----------------|------------|
| `app.js`        | the UI — sidebar, article list / video grid, add + settings dialogs |
| `db.js`         | `@bunker/db`: `feeds`, `items`, and a `read` set; refresh + upsert logic |
| `feed.js`       | fetch (direct→proxy) + parse (RSS/Atom, YouTube-aware) + channel-URL resolution |
| `app.css`       | the app's own look |
| `index.html`    | links `../base.css` + `app.css` and the importmap |
| `manifest.json` | pwa manifest (generated from the registry) |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |

### the CORS reality

Almost no feed sends CORS headers, so a direct browser `fetch` is usually
blocked. Like [`apps/podcasts`](./../podcasts/), each feed is fetched **directly
first** and, on failure, retried through a **CORS proxy** whose URL you set in
Settings (`{url}` is the placeholder). Clear it to use direct requests only.

### YouTube resolution

`feed.js` turns a YouTube reference into its feed URL
(`youtube.com/feeds/videos.xml?channel_id=…`): `/channel/UC…` and `?list=…`
playlists are built directly; an `@handle`, `/user/`, `/c/`, or video URL has the
channel id scraped from the page (fetched through the same proxy). Those feeds
are tagged `youtube` and rendered as video cards.

## notes

Everything is on-device; the only network traffic is fetching the feeds
themselves. Reading always opens the original in a new tab.
