# apps/template

the blueprint of an **app**. apps are the counterpart to `tools/`: where a tool
is a small single-purpose page rendered inside the shared tools shell, an app is
meant to feel like a real application — it draws its own chrome and brings its
own css. copy this folder, rename it to your slug, then:

1. add an entry for the slug to `shared/js/registry.js` with `type: 'app'`
2. change the slug in `app.js`'s `app.js?slug=…` import to yours
3. drop an `app.svg` in
4. write the app in `app.js`

`manifest.json` and the `assets/` icons (`icon.svg`, `icon-192.png`,
`icon-512.png`) are **generated** from the registry entry + `app.svg` — don't
hand-edit them. Run `npm run gen:assets` (or just push: the *app assets* GitHub
Action regenerates and commits them). Everything user-facing — name, short
name, description, categories, colour — lives in the registry entry, so the
launcher, the app and the manifest can never drift. Need manifest-only tweaks
(e.g. app-store categories)? Add a `manifest: { … }` object to the registry
entry; it overrides just those keys.

## what makes an app an app

| | tools | apps |
|---|---|---|
| css | `shared/css/index.css` (reset + theme + typo + layout + components) | `apps/base.css` (reset + theme tokens + `#app` frame) **only** — the rest is the app's own `app.css` |
| chrome | the shared `Shell` header + settings panel | the app draws everything itself — boot skips the Shell for `type: 'app'` |
| feel | a form on a page | a real app |

what apps still share with everything else: the theme tokens (so a theme picked
anywhere carries across), the import map, the aufbau runtime and the service
worker.

## files

| file            | what it is |
|-----------------|------------|
| `index.html`    | the static shell — links `../base.css`, the app css and the importmap |
| `app.js`        | the app itself; imports its entry via `app.js?slug=…` and mounts through `boot()` |
| `app.css`       | the app's own look — starts from nothing |
| `manifest.json` | pwa manifest — **generated** from the registry, don't hand-edit |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon — the source the `assets/` PNGs are rasterised from |
| `assets/`       | **generated** icons (`icon.svg`, `icon-192.png`, `icon-512.png`) |
