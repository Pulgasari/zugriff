# techstack

## @aufbau

the core we use gonna be `@aufbau/kits/preact-htm` containing all the
aufbau-packages under one hood, combined with htm and preact (and some
preact-extensions).

- `@aufbau/elements` — the shared components are thin preact wrappers around the aufbau-elements, so the look comes from aufbau and the api stays preact
- `@aufbau/filters`
- `@aufbau/import`

## @bunker

for caching and storage stuff we gonna use [@bunker](https://github.com/pulgasari/bunker/).

`stored()` in `shared/js/lib/signals.js` is the persisted-signal helper every app uses for its settings.

## @domina

for dom manipulation stuff we gonna use [@domina](https://github.com/pulgasari/domina/).

## utils

- `@pulgasari/is`
- `@pulgasari/str`
- `@pulgasari/timing`

## vendors

everything else comes off a cdn through the import map in
`shared/js/boot.js` — yaml, smol-toml, csso, terser,
html-minifier-terser, culori, pdf-lib, pdfjs, highlight.js, ffmpeg, upng-js.
nothing is vendored into this repo; the ffmpeg core wasm alone is 32 mb and is
fetched on first use, then kept by the service worker.

## caching

each app — and the launcher — ships a one-line `sw.js` that pulls in
`shared/js/sw-core.js`. it is a **module** service worker: import maps do not
apply inside a worker, so `@bunker/cache` is imported by its full url there.

`shared/js/sw-core.js` splits the traffic in two:

| cache | holds | policy |
|---|---|---|
| `zugriff-<slug>-v2` | the app's own files + the shared css/js | stale-while-revalidate, conditional on `ETag`/`Last-Modified` — an unchanged file costs a 304 |
| `zugriff-vendor-v2` | third party modules pinned to a version in the url (`esm.sh/preact@10.20.1`, `unpkg.com/@ffmpeg/core@0.12.6/…`) | cached for a year, never refetched — and shared by every app, so preact is stored once, not thirty times |

anything else on a foreign origin — iconify, google fonts — is **not** touched.
revalidating it would mean adding `If-None-Match`/`If-Modified-Since`, which
turns a simple request into a preflighted one, and `api.iconify.design` does
not allow those headers: the icons would load once and then start failing.

the revalidation is handed to `event.waitUntil` via bunker's `keepAlive`, so a
refresh started on the last request of a session is not lost when the worker is
killed. the launcher's scope is the site root `/` (on `zugriff.dev`), which sits
above every app — it deliberately ignores anything under `tools/` and `apps/` so
each app's own worker owns its files.

the cache name comes from the registration scope, so nothing is generated per
app. bump `VERSION` in `sw-core.js` to invalidate everything.
