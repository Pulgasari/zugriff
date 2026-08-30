![Logo](/logo.svg)

# zugriff

client-side mini-PWAs. static files only — no build step, no bundler, no node or deno. ESM in the browser, served straight off GitHub Pages.

- https://zugriff.dev/
- [zugriff/cli](https://zugriff.dev/cli/)
- [apps](https://zugriff.dev/apps/)
- [tools](https://zugriff.dev/tools/)

## apps
- [audio manager](https://zugriff.dev/audio-manager/)
- [code](https://zugriff.dev/code/)
- [ebooks](https://zugriff.dev/ebooks/)
- [feeds](https://zugriff.dev/feeds/)
- [files](https://zugriff.dev/files/)
- [icons](https://zugriff.dev/icons/)
- [images](https://zugriff.dev/images/)
- [notes](https://zugriff.dev/notes/)
- [podcasts](https://zugriff.dev/podcasts/)
- [prompts](https://zugriff.dev/prompts/)
- [videoplayer](https://zugriff.dev/videoplayer/)

### deprecated
- [gifmaker](https://zugriff.dev/gifmaker/)
- [image editor](https://zugriff.dev/image-editor/)
- [image viewer](https://zugriff.dev/image-viewer/)

---

## about

- `/cli` basically is zugriff itself or the main app so to speak.
- `/tools` small single-purpose pages, rendered inside the shared tools shell
- `/apps` the ones meant to feel like real apps — own chrome, own css
- `/shared` stuff used by all/multiple apps

every app is its own PWA: own manifest, own service worker scope, installable
on its own. tools share the shell, the components and the css; apps deliberately
do not — see [apps vs tools](#apps-vs-tools) below.

## structure

```
zugriff/
  index.html  app.js  app.css   the launcher, rendered from tools/registry.js
  manifest.json  sw.js          the launcher is an installable pwa too
  icon.svg
  tools/
    registry.js                 single source of truth for every tool's metadata
    template/                   the blueprint — copy this to start a tool
    <slug>/                     index.html app.js app.config.js app.css
                                sw.js manifest.json app.svg assets/
  apps/
    index.html  app.js          the apps overview — the /tools launcher's sibling
    registry.js                 single source of truth for every app's metadata
    base.css                    the apps foundation: reset + theme tokens + #app frame
    template/                   the blueprint — copy this to start an app
    <slug>/                     index.html app.js app.config.js app.css
                                sw.js manifest.json app.svg
  shared/
    css/
      index.css                 always linked: reset + theme + typo + layout + components
      panes.css                 opt-in: the code input/output panes
      inspector.css             opt-in: the data tree
      explorer.css              opt-in: the FileExplorer component
      hljs.css                  opt-in: syntax highlighting theme
    js/
      boot.js                   theme on :root + import map, one classic script in <head>
      app.js                    boot(): document setup, runtime, sw, mount
      sw-core.js                the shared service worker body
      vfs.js                    flat OPFS wrapper (used by the cli)
      lib/dirfs.js              directory-tree fs over any handle + opfsBackend
      components/               index.js (light) · code.js (panes) · media.js (audio)
      patterns/                 whole apps from a handful of options
      data/                     icons — short names for the iconify ids
      lib/                      data-converters, signals, thumbs, ffmpeg, theme
  cli/                          the wasm micro terminal
```

## adding a tool

1. `cp -r tools/template tools/my-tool`
2. add an entry to `tools/registry.js`
3. in `app.config.js` swap the literal for `appMeta('my-tool')`
4. drop an `app.svg` in and generate `assets/` with the
   [icon-generator](./tools/icon-generator/) app
5. update `manifest.json`, write `app.js`

## apps vs tools

a **tool** is a small single-purpose page — it renders inside the shared tools
`Shell` (header + settings panel) and links `shared/css/index.css`, so it
inherits the whole tools look for free. most of `tools/` is a
[pattern](#patterns) plus a handful of options.

an **app** is meant to feel like a real application. it draws its own chrome and
brings its own css — no `Shell`, and instead of `index.css` it links only
`apps/base.css` (reset + theme tokens + the `#app` frame). `boot({ shell: false })`
hands it the bare `#app` element and it takes it from there.

|            | tools                                   | apps                                   |
|------------|-----------------------------------------|----------------------------------------|
| lives in   | `tools/<slug>/`                         | `apps/<slug>/`                         |
| css        | `shared/css/index.css` + `app.css`      | `apps/base.css` + `app.css`            |
| chrome     | shared `Shell` header + settings        | its own, `boot({ shell: false })`      |
| registry   | `tools/registry.js`                     | `apps/registry.js`                     |

what apps still share with everything else: the theme tokens (so a theme picked
anywhere carries across), the import map, the aufbau runtime and the service
worker. apps and tools live in **separate overviews** — `/` lists the tools,
`/apps/` lists the apps — and the nav in the top-right switches between the
three places: `cli`, `tools`, `apps`. each app's own worker owns its files,
exactly like a tool's does.

the apps so far:
[apps/files](./apps/files/) — grant a folder off your disk and
browse it as the root, built on the shared
[`FileExplorer`](./shared/js/components/FileExplorer.js) component (which, over
`dirfs.js`'s `opfsBackend`, also browses the private OPFS the cli uses);
[apps/image-editor](./apps/image-editor/) — crop/rotate/flip/adjust images
on a canvas; [apps/image-viewer](./apps/image-viewer/) — view images opened via
the OS "open with" (File Handling API / `launchQueue`), a picker or drag-and-drop,
with zoom/pan and multi-image nav; [apps/gifmaker](./apps/gifmaker/) — sequence
images into an animation and export a GIF or a project zip;
[apps/podcasts](./apps/podcasts/) — subscribe by RSS, play episodes and track
progress, backed by `@bunker/db`;
[apps/feeds](./apps/feeds/) — follow RSS/Atom feeds, skim the latest
across all of them and click through to the original, with YouTube channels in
their own section;
[apps/audio-manager](./apps/audio-manager/) — grant your music folders and browse
the library by song, album and artist, tags + cover art read on device and played
straight off disk;
[apps/icons](./apps/icons/) — browse and search the whole Iconify library by set,
copy or download any icon and keep favourites, the grid rendered through
`<iconify-icon>`;
[apps/notes](./apps/notes/) — grant a folder of Markdown files and read it as a
foldered notebook, the directory tree becoming the outline; and
[apps/ebooks](./apps/ebooks/) — grant your book folders and read the EPUB/PDF
library with covers, search and a remembered reading position. The last two
share [`shared/js/lib/fsaccess.js`](./shared/js/lib/fsaccess.js), the File System
Access wrapper that grants a real on-disk folder (the counterpart to the private
OPFS the files app uses).

## adding an app

1. `cp -r apps/template apps/my-app`
2. add an entry to `apps/registry.js`
3. in `app.config.js` swap the literal for `appMeta('my-app')`
4. drop an `app.svg` in
5. write `app.js` and `app.css`

`manifest.json` and each app's `assets/` icons are **generated** from the
registry entry + `app.svg` by [`.github/scripts/gen-app-assets.mjs`](./.github/scripts/gen-app-assets.mjs)
— `npm run gen:assets` locally, or just push and the *app assets* GitHub Action
([`.github/workflows/app-assets.yml`](./.github/workflows/app-assets.yml))
regenerates and commits them whenever `app.svg`, `app.config.js` or the registry
changes. `npm run check:assets` fails if anything is stale or missing. So the
registry is the one place name, icon, description, categories and colour are
declared — the launcher, the app and its manifest stay in lock-step.

## patterns

three blueprints cover most of the apps — an app is then just its options:

| pattern | what it builds |
|---|---|
| `CodeTransformerApp` | input pane → `execute(src)` → output pane |
| `CodeConverterApp`   | same, plus an output format switcher — `execute(src, format)` |
| `DataInspectorApp`   | paste → `parse(src)` → browsable tree |

the transformer and the converter are the same thing (`CodeWorkbenchApp`); both
names stay because they read better at the call site.

```javascript
import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'my-app',
  lang        : 'json',
  actionLabel : 'Minify',
  execute     : src => JSON.stringify(JSON.parse(src)),
});

boot({ config, App });
```

## settings

`shared/js/lib/settings.js` describes a setting well enough for the panel to render it without knowing what it means, so a new one is a single schema entry:

```javascript
export const launcher = defineSettings('zugriff:launcher', {
  'filter-position' : { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  'filter-sticky'   : { type: 'boolean', default: true },
});
```

three types so far — `boolean`, `enum`, `color`. 

- an enum with more than four options renders as a `<aufbau-picker look='combobox'>`, fewer as segments;
- an entry can override that with its own `look`.
- keys are shown verbatim in the ui, no label mapping.
- every setting is a persisted signal, so it survives a reload and syncs across tabs.
- the panel lives between the header and the app's body;
- `Shell` puts the button in every tool-app's header,
- and an app that has no settings of its own still gets the theme group.
- per-app settings would use the slug as their namespace ...
- ... the theme group deliberately does not — picking an accent in one app picks it in all of them.

### themes

- a preset is only three colours (`bg`, `fg`, `accent`) in `shared/js/data/themes.js`.
- everything else in the palette is derived from those in `shared/css/theme.css`, so the panel writes three custom properties
onto `:root` and the whole thing repaints.
- editing a colour by hand switches the preset to `custom`.

---

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
