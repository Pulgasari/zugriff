# www

- podcasts [web-bundle](https://app.zugriff.dev/podcasts/)

the bundled web part of the apps built as `capacitor`, one folder per app,
written by `.github/workflows/ota-publish.yml` (`commit_www`). the same files go
into the over-the-air zip of the release `ota-<slug>` and, staged the same way,
into the apk.

what a folder holds, from `@aufbau/bundler` (`bundler.config.js`):

- the shell (`index.html`, `.shared/`) and the app (`<slug>/`)
- the first-party packages as `_pkg/` instead of `code.pulgasari.dev`
- the third-party modules as `_vendor/` instead of esm.sh, jsdelivr, unpkg
- the icons the code names as `_icons/provide.js`, the fonts it uses
- `ota.json`: `{ slug, version, manifest }`, the bundle's version

nothing here is edited by hand, every run replaces the folder.

## as a web version

a folder is a site of its own: its paths start at `/` (`/_pkg/…`, `/.shared/…`,
`/<slug>/app.js`), so it has to be the root of what serves it. it does **not** work
as `zugriff.dev/www/<slug>/`, vercel would also rewrite that to `apps/`.

```sh
npx serve -s www/podcasts     # -s: unknown paths fall back to index.html
# open http://localhost:3000/ — it moves on to /podcasts/ by itself
```

a deploy works the same way: a project (or subdomain) with `www/<slug>` as its
root and every path rewritten to `/index.html`.

## what to compare with the live version

the live version (`zugriff.dev/<slug>/`) loads the same code unbundled: every
module from `code.pulgasari.dev`, esm.sh and the other cdns, every icon from the
iconify api. the bundle loads everything from one origin and only what the app
reaches. worth measuring side by side, cold and warm (service worker):

- requests and bytes on the first load (devtools, network)
- time to the first view (`performance.getEntriesByType('navigation')`, lcp)
- the second load, with the service worker's cache
