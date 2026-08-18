# apps/template

the blueprint of an **app**. apps are the counterpart to `tools/`: where a tool
is a small single-purpose page rendered inside the shared tools shell, an app is
meant to feel like a real application — it draws its own chrome and brings its
own css. copy this folder, rename it to your slug, then:

1. add an entry for the slug to `apps/registry.js`
2. in `app.config.js` swap the literal for `appMeta('<slug>')`
3. drop an `app.svg` in
4. update `manifest.json` (name, description, id)
5. write the app in `app.js`

## what makes an app an app

| | tools | apps |
|---|---|---|
| css | `shared/css/index.css` (reset + theme + typo + layout + components) | `apps/base.css` (reset + theme tokens + `#app` frame) **only** — the rest is the app's own `app.css` |
| chrome | the shared `Shell` header + settings panel | the app draws everything itself; `boot({ shell: false })` |
| feel | a form on a page | a real app |

what apps still share with everything else: the theme tokens (so a theme picked
anywhere carries across), the import map, the aufbau runtime and the service
worker.

## files

| file            | what it is |
|-----------------|------------|
| `index.html`    | the static shell — links `../base.css`, the app css and the importmap |
| `app.js`        | the app itself, mounted through `boot({ shell: false })` |
| `app.config.js` | registry entry + aufbau runtime options |
| `app.css`       | the app's own look — starts from nothing |
| `manifest.json` | pwa manifest, all paths relative |
| `sw.js`         | one-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | the app icon |
