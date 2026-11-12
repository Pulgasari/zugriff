## structure

```
zugriff/
  apps/
    <slug>/                 the source of an app: index.html, app.rat.html, config.rat.js, components/ …
    .shared/                what the apps have in common: components, css, fs, http, icons, toast …
    zugriff.config.js       the config every app spreads into its own config.rat.js
    postcss.config.js       gestalt's postcss plugin, for the css of a build
  android/
    <app>/                  the android-only apps (web layer of wallpaperfx), built into ../wallpaperfx/apps/<app>/www
    .shared/                native bridge, glyphs, toast
  www/
    <slug>/                 an app built (rat build), written by the build workflow. never edited by hand
  .github/
    config.js               what the workflows do, as data
    scripts/                repos.mjs (sibling checkouts), android.mjs (apks), config.mjs
    workflows/              build.yml (apps -> www), android.yml (apks into a release)
  404.html                  the start page and the page for what was not found
  middleware.js             vercel edge: <slug>.zugriff.dev -> www/<slug>/
  vercel.json               zugriff.dev/<slug>/ -> www/<slug>/
```

## sibling checkouts

nothing of rat is in this repo. the sources and the build expect these next to zugriff:

```
rat/  aufbau/  bunker/  domina/  gestalt/  htx/  js-packages/      (wallpaperfx/ for android/)
```

- a source page loads `../../../rat/packages/app/run/run.js`, which writes the import map into the others
- `node ../rat/packages/cli/index.js build apps/<slug>` builds one app into `www/<slug>`
- `node ../rat/packages/cli/index.js dev apps/<slug>` serves one while working on it
