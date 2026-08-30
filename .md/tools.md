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

