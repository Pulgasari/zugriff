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
