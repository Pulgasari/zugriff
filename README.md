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

## tools
[audio-converter](https://zugriff.dev/audio-converter/)
[audio-cutter](https://zugriff.dev/audio-cutter/)

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
