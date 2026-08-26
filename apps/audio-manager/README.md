# apps/audio-manager

A music library over folders on your **own disk** — iTunes/Banshee-style, but
client-side. Grant a folder, the audio files are scanned and their **tags + cover
art** read on device, and the library is browsed by song, album or artist.
Nothing is uploaded or copied; only the directory handles are persisted, and
audio is streamed straight off disk on play.

## what it does

- **grant folders** (File System Access) — scanned two-phase: filenames show up
  instantly, then tags + covers fill in through a bounded background pool
- browse by **Songs** (sortable, searchable table), **Albums** (cover grid →
  album detail) and **Artists** (→ their albums)
- a persistent **player**: play/pause, prev/next, seek, volume, shuffle and
  repeat (off / all / one); a queue is the list you played from
- re-tag only changed files (size+mtime signature); reconnect a folder that
  needs permission again

## how it's built

*App*, not a *tool*: own chrome, own css (`app.css` over `apps/base.css`).

| file          | what it is |
|---------------|------------|
| `app.js`      | the UI — sidebar, songs/albums/artists views, player bar |
| `db.js`       | `@bunker/db`: `sources` + `tracks`, two-phase scan through `shared/js/lib/pool.js` |
| `library.js`  | tag + cover extraction via `music-metadata`, cover downscale |
| `player.js`   | one shared `<audio>`, queue + controls mirrored into signals |
| `app.css`     | the app's own look |
| `index.html` · `manifest.json` · `sw.js` · `app.svg` | shell, manifest (generated), worker, icon |

Reuses `shared/js/lib/fsaccess.js` (grant/scan folders, like notes/ebooks),
`shared/js/lib/pool.js` (bounded extraction) and `@bunker/db` for storage.
Tags come from [`music-metadata`](https://github.com/borewit/music-metadata)
via the shared importmap.

## notes

Folder permissions don't survive a plain reload everywhere, so the app nudges
you to **install** it (an installed PWA keeps the grant). Browsers without the
File System Access API get a friendly “can't open folders here” screen. Covers
are downscaled to ~400px webp so a big library doesn't bloat IndexedDB.
