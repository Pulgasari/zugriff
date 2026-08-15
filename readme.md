# zugriff

client-side mini-PWAs. static files only — no build step, no bundler, no node
or deno. ESM in the browser, served straight off GitHub Pages.

- launcher: [pulgasari.github.io/zugriff](https://pulgasari.github.io/zugriff/)
- cli: [zugriff/cli](https://pulgasari.github.io/zugriff/cli/)

---

## about

- `/cli` basically is zugriff itself or the main app so to speak.
- `/apps` here are the apps we build, kinda like multiple sub-projects of zugriff
- `/shared` stuff used by all/multiple apps

every app is its own PWA: own manifest, own service worker scope, installable
on its own. what they share is the shell, the components and the css.

## structure

```
zugriff/
  index.html  app.js  app.css   the launcher, rendered from apps/registry.js
  manifest.json  sw.js          the launcher is an installable pwa too
  icon.svg
  apps/
    registry.js                 single source of truth for every app's metadata
    template/                   the blueprint — copy this to start an app
    <slug>/                     index.html app.js app.config.js app.css
                                sw.js manifest.json app.svg assets/
  shared/
    css/
      index.css                 always linked: reset + theme + typo + layout + components
      panes.css                 opt-in: the code input/output panes
      inspector.css             opt-in: the data tree
      hljs.css                  opt-in: syntax highlighting theme
    js/
      importmap.js              injects the import map, classic script in <head>
      app.js                    boot(): document setup, runtime, sw, mount
      sw-core.js                the shared service worker body
      vfs.js                    OPFS wrapper (used by the cli)
      components/               index.js (light) · code.js (panes) · media.js (audio)
      patterns/                 whole apps from a handful of options
      data/                     icons — short names for the iconify ids
      lib/                      data-converters, signals, ffmpeg, theme
  cli/                          the wasm micro terminal
```

## adding an app

1. `cp -r apps/template apps/my-app`
2. add an entry to `apps/registry.js`
3. in `app.config.js` swap the literal for `appMeta('my-app')`
4. drop an `app.svg` in and generate `assets/` with the
   [icon-generator](./apps/icon-generator/) app
5. update `manifest.json`, write `app.js`

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

`shared/js/lib/settings.js` describes a setting well enough for the panel to
render it without knowing what it means, so a new one is a single schema entry:

```javascript
export const launcher = defineSettings('zugriff:launcher', {
  'filter-position' : { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  'filter-sticky'   : { type: 'boolean', default: true },
});
```

three types so far — `boolean`, `enum`, `color`. an enum with more than four
options renders as a `<aufbau-picker look='combobox'>`, fewer as segments; an
entry can override that with its own `look`. keys are shown verbatim in the ui,
no label mapping. every setting is a persisted signal, so it survives a
reload and syncs across tabs.

the panel lives between the header and the app's body; `Shell` puts the button
in every app's header, and an app that has no settings of its own still gets
the theme group. per-app settings would use the slug as their namespace, the
theme group deliberately does not — picking an accent in one app picks it in
all of them.

### themes

a preset is only three colours (`bg`, `fg`, `accent`) in
`shared/js/data/themes.js`. everything else in the palette is derived from
those in `shared/css/theme.css`, so the panel writes three custom properties
onto `:root` and the whole thing repaints. editing a colour by hand switches
the preset to `custom`.

## techstack

### @aufbau

the core we use gonna be `@aufbau/kits/preact-htm` containing all the
aufbau-packages under one hood, combined with htm and preact (and some
preact-extensions).

- `@aufbau/elements` — the shared components are thin preact wrappers around
  `<aufbau-icon>`, `<aufbau-picker>`, `<aufbau-slider>`, `<aufbau-toggle>` and
  `<aufbau-upload>`, so the look comes from aufbau and the api stays preact
- `@aufbau/import`

### @bunker

for caching and storage stuff we gonna use [@bunker](https://github.com/pulgasari/bunker/).
`stored()` in `shared/js/lib/signals.js` is the persisted-signal helper every
app uses for its settings.

### @domina

for dom manipulation stuff we gonna use [@domina](https://github.com/pulgasari/domina/).

### utils

- `@pulgasari/is`
- `@pulgasari/str`
- `@pulgasari/timing`

### vendors

everything else comes off a cdn through the import map in
`shared/js/importmap.js` — yaml, smol-toml, csso, terser,
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
killed. the launcher's scope is `/zugriff/`, which sits above every app — it
deliberately ignores anything under `apps/` so each app's own worker owns its
files.

the cache name comes from the registration scope, so nothing is generated per
app. bump `VERSION` in `sw-core.js` to invalidate everything.
