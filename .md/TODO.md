# todo

## `apps/code`
- [ ] geteilter editor-panel um mehrere files nebeneinander einzusehen/bearbeiten
- [ ] files in der fileList sticky machen können
- [ ] editor-settings je filetype/ext setzbar
- [ ] sonderbehandlung im editor für kommentare
  - [ ] option für: `font`
  - [ ] option für: `font-size` default 0.75 bezogen auf editors font-size
  - [ ] option für: `italic` bool
  - [ ] option für: `opacity` 0.25 bis 1.00 in 0.5 steps
  - [ ] möglichkeit für sondercomments (zb "startet mit `todo:`) welche besonders hervorgehoben und/oder erfasst werden, zb um sie aufzulisten.oder hinzuspringen
  - [ ] evtl. md-syntax/-highlighting

### features, wo ich nicht weiß, ob/wie das umzusetzen ginge:
- [ ] collaborations-modus

## `apps/icons`
- [ ] icons favorisieren
- [ ] iconsets favorisieren
- [ ] toggle on/off um bei suchergebnissen icons von favorisierten iconsets gesondert/zuerst anzuzeigen
- [ ] icon-farbe + bg des containers in vorschau setzen
- [ ] nach mehreren icons gleichzeitig suchen durch komma
- [ ] icons merken (nicht das selbe wie favorisieren), bin mir noch unsicher bzgl genauer umsetzung
- [ ] startseite bestehend aus mehreren panels:
  - [ ] fav icons
  - [ ] fav iconsets
  - [ ] search-input (autofokusiert)
  - [ ] iconsets 

## `apps/podcasts`
- [x] neuen View "explore" erstellen
  - [x] zunächst ist er im prinzip ähnlich zum 'add podcasts'-dialog, zumindest in dem sinne, dass man ne suche hat, und podcasts gelistet werden. aber bei klick auf podcasts, sieht man mehr infos, dessen episoden usw.
  - [x] man kann ihn dann manuell subscriben
  - [x] zusätzlich sollte man sich podcasts auch merken können (zweck: man weiss noch nicht im der podcast einem taugt, aber er weckt interesse beim exploren, man will ihn später genauer abchecken)
  - [x] im Dock verdrahten als viertes.
  - [x] `country` über picker wählbar (`/.shared/json/countries.json`, 158 storefronts)
  - [x] `attribute` über picker wählbar (title / author / description / genre, plus "anything" = parameter weglassen)
  - [x] tabs im explore-view: podcasts / episodes (`entity=podcast` bzw. `podcastEpisode`)

---

## builds for android
- [x] variante 1: bubblewrap
- [x] variante 2: capacitor via webview wrapper um `https://zugriff.dev/<app>/`
- [x] variante 3: capacitor + komplettes bundle
- [ ] variante 4: capacitor + OTA / live update

### anmerkungen
- variante 1 und 2 sind mir nicht genug für android-versionen der zugriff-apps
- variante 3 erscheint mir wiederum too much
- variante 4 wäre vermutlich das beste aus "both worlds"

### name + id der builds
- variante 1: `dev.zugriff.<app>.bw`     | `AppName (BW)`
- variante 2: `dev.zugriff.<app>.live`   | `AppName (live)`
- variante 3: `dev.zugriff.<app>.bundle` | `AppName (bundle)`
- variante 4: `dev.zugriff.<app>`        | `AppName`

- [x] aktuell sind die spaces ober- und unterhalb des app-screens bei den android-capacitor-apps schwarz anstatt bg-farbe des themes zu haben. wenn ich mich recht erinnere, sollte das gerade durch capacitor fixbar sein?
- [x] die android-apps haben alle das default-capacitor-icon, sollten aber eigtl. alle ihr eigenes haben

### planung/konzeot
- [ ] außerdem will ich noch ne zweite "bauweise" erschaffen, die die apps bundled anstatt bloß ihre web/live/url zu wrappen. wie könnte man das machen? wad für verschiedene möglichkeiten gäbe es?
  - [ ] appIds: bundled = `dev.zugriff.<appname>`, live-url-wrapper = `dev.zugriff.<appname>.live` (aktuell hat der live-build noch `dev.zugriff.<appname>`, muss umgestellt werden)
