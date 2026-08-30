# todo

## apps

- [x] create `apps/code`
- [x] create `apps/icons`
- [x] rename `apps/file-explorer` to `apps/files`.
- [x] rename `apps/rss-reader` to `apps/feeds`

### `apps/code`

- [ ] connection to (s)ftp
- [ ] connection to cloud-services
- [ ] add mechanism to github-panel to add public repos to read/inspect

---

## shared

- [ ] neuen boot-mechanismus (`.shared/js/boot.js`) fertigstellen. ersetzt dann `importmap.js`, `theme-boot.js` usw.
- [ ] ich hab angefangen ne globale runtime (als `zugriff` am `window` bzw. `globalThis`) zu konstruieren, sodass components fortan in den apps via `zugriff.components` genutzt werden können, prompts via `zugriff.openPrompts` getriggert, oder settings-panel via `zugriff.toggleSettings` (wäre für Toasts bspw. ebenfalls sinnvoll das dort zu binden)

### components
- [ ] Warum nutzt `.shared/js/components/WaveForm.js` nicht `<aufbau-waveform>` (`aufbau/elements/AufbaueWaveform'? Muss AufbauWaveform evtl. erweitert werden?
- [ ] create `Index` component, die `<aufbau-index>` benutzt, und in den `zugriff/apps` integriert wird, wo es passt. (im prinzip überall wo gleichartige items aufgelistet werden)

### settings component

- [x] `shared/js/components/Settings.js` sollte `aufbau.gui` (`aufbau/runtime/gui.js`) nutzen
- [x] in der `shared/js/registry.js` bekommen die apps settings-option für font, dir vorgegeben fonts kommen aus `aufbau/webfonts`usw

---

## workflow

- [ ] bundle-workflows (gh actions) of bubblewrap or capacitor should not run on any commit

---

## misc

- [x] urls der der apps/tools direkt als unterpfad der domain ohne sie aus den `apps`- bzw. `tools`-ordnern eine ebene höher schieben zu müssen. also z.b `zugriff.dev/code` statt `zugriff.dev/apps/code`. (theoretisch wären subdomains noch nicer, aber das macht vermutlich caching, resourcen-sharing usw wieder übertrieben komplizierter)
