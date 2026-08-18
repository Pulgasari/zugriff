# tools/template

the blueprint of an app. copy the folder, rename it to your slug, then:

1. add an entry for the slug to `tools/registry.js`
2. in `app.config.js` swap the literal for `appMeta('<slug>')`
3. put `app.svg` in the folder and generate `assets/` with the icon-generator app
4. update `manifest.json` (name, description, id)
5. write the app in `app.js`

## files

| file            | what it is |
|-----------------|------------|
| `index.html`    | the static shell — links the shared css and the importmap |
| `app.js`        | the app itself, mounted through `boot()` |
| `app.config.js` | registry entry + aufbau runtime options |
| `app.css`       | app specific css only |
| `manifest.json` | pwa manifest, all paths relative |
| `sw.js`         | three-liner, pulls in `shared/js/sw-core.js` |
| `app.svg`       | source for the generated icons |
| `assets/`       | generated `icon.svg`, `icon-192.png`, `icon-512.png` |
