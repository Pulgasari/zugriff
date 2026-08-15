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
      lib/                      data-converters, signals, ffmpeg
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

## service worker

each app ships a three-line `sw.js` that pulls in `shared/js/sw-core.js`. the
cache name is derived from the registration scope, so every app gets its own
cache without anything being generated. strategy is stale-while-revalidate.
