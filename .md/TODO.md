# todo

## apps

- [x] create `apps/code`
- [x] create `apps/icons`
- [x] rename `apps/file-explorer` to `apps/files`.
- [x] rename `apps/rss-reader` to `apps/feeds`

### `apps/code`

- [ ] connection to (s)ftp — zurückgestellt: geht im browser nur über einen relay/proxy (kein raw tcp/ssh), braucht ein backend
- [ ] connection to cloud-services — zurückgestellt: braucht registrierte oauth-apps + client-ids
- [x] add mechanism to github-panel to add public repos to read/inspect — public repo per `owner/name` oder url pinnen, read-only browsen (auch ohne token)

---

## shared

- [x] neuen boot-mechanismus (`.shared/js/boot.js`) fertigstellen. ersetzt dann `importmap.js`, `theme-boot.js` usw. — vollständige importmap in boot.js, alle html auf den einen `boot.js`-tag umgestellt, `importmap.js`/`theme-boot.js`/`boot1.js` gelöscht (sw-registrierung bleibt bei `app.js`)
- [x] ich hab angefangen ne globale runtime (als `zugriff` am `window` bzw. `globalThis`) zu konstruieren, sodass components fortan in den apps via `zugriff.components` genutzt werden können, prompts via `zugriff.openPrompts` getriggert, oder settings-panel via `zugriff.toggleSettings` (wäre für Toasts bspw. ebenfalls sinnvoll das dort zu binden) — `zugriff.toast` ist nun gebunden (neben `components`, `openPrompt`, `toggleSettings`, `fs`, `opfs`, `registry`)

### components
- [x] Warum nutzt `.shared/js/components/WaveForm.js` nicht `<aufbau-waveform>` (`aufbau/elements/AufbaueWaveform'? Muss AufbauWaveform evtl. erweitert werden? — `<aufbau-waveform>` malt DOM-bars für einen progress-wert; die audio-apps brauchen selection-range + playhead als canvas-overlay, das bleibt daher canvas. der eine echte gap (vorab berechnete peaks statt erzwungenem decode) ist geschlossen: AufbauWaveform nimmt jetzt ein `peaks`-attribut.
- [x] create `Index` component, die `<aufbau-index>` benutzt, und in den `zugriff/apps` integriert wird, wo es passt. (im prinzip überall wo gleichartige items aufgelistet werden) — component erstellt; app-integration noch offen (inkrementell)
- [x] create 'InstallTip' component (wird aktuell in zig apps doppelt konstruiert) — erstellt; `notes` migriert als referenz, übrige apps noch offen
- [x] create 'Sidebar' component (wird aktuell in zig apps doppelt konstruiert) — shared drawer-shell erstellt; app-migration noch offen (hängt am css-refactor)
- [x] create 'Toast' component (wird aktuell in zig apps doppelt konstruiert) bzw kleines Toast-System, dass wie weiter oben dann mit an `zugriff` runtime direkt hängen sollte — auf `<aufbau-toast>` gebaut, an `zugriff.toast` gehängt; `notes` migriert, übrige apps noch offen

### settings component

- [x] `shared/js/components/Settings.js` sollte `aufbau.gui` (`aufbau/runtime/gui.js`) nutzen
- [x] in der `shared/js/registry.js` bekommen die apps settings-option für font, dir vorgegeben fonts kommen aus `aufbau/webfonts`usw

---

## workflow

- [x] bundle-workflows (gh actions) of bubblewrap or capacitor should not run on any commit — `push`-trigger entfernt, nur noch `workflow_dispatch` (manuell)

---

## misc

- [x] urls der der apps/tools direkt als unterpfad der domain ohne sie aus den `apps`- bzw. `tools`-ordnern eine ebene höher schieben zu müssen. also z.b `zugriff.dev/code` statt `zugriff.dev/apps/code`. (theoretisch wären subdomains noch nicer, aber das macht vermutlich caching, resourcen-sharing usw wieder übertrieben komplizierter)
- [ ] komplettes refactoring des CSS (das mache ich. und habe damit schon angefangen bzw. bin mittendrin. also das muss dich erstmal nicht jucken wenn du irgendwo kaputtes css bemerkst, ist dann vermutlich dem noch-im-umbau-refactor-prozess)
