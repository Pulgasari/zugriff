# todo :: apps

## `apps/code`

#### panel: editor
- [ ] geteilter editor-panel um mehrere files nebeneinander einzusehen/bearbeiten

#### panel: file-list
- [ ] files in der fileList sticky machen können

#### panel; github
- [ ] prüfen, ob/inwiefern die integration von gh actions/workflows möglich wäre, sodass man diese quasi von der app aus ausführen kann. und insb. diese besser zu handhaben wären als auf github.com, wo man sich zu tode kreuz und quer klicken muss

#### panel: settings
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

# todo :: builds

## builds for android
- [x] variante 1: bubblewrap
- [x] variante 2: capacitor via webview wrapper um `https://zugriff.dev/<app>/`
- [x] variante 3: capacitor + komplettes bundle
- [ ] variante 4: capacitor + OTA / live update

### anmerkungen
- variante 1 und 2 sind mir nicht genug für android-versionen der zugriff-apps
- variante 3 erscheint mir wiederum too much
- variante 4 wäre vermutlich das beste aus "both worlds"
- nutzen für variante 4 will ich `@capgo/capacitor-updater` weil meine recherche ergab, dass dies hier vom repo aus funtionieren müsste

### fortan gilt: name + id der builds
- variante 1: `dev.zugriff.<app>.bw`     | `AppName (BW)`
- variante 2: `dev.zugriff.<app>.live`   | `AppName (live)`
- variante 3: `dev.zugriff.<app>.bundle` | `AppName (bundle)`
- variante 4: `dev.zugriff.<app>`        | `AppName`

### fortan gilt: angabe der buildtypes in `/.shared/js/data/apps.js"
- variante 1: `bubblewrap`
- variante 2: `capacitor-live`
- variante 3: `capacitor-bundle`
- variante 4: `capacitor`

(die angaben dort können also aktuell so bleiben wie se schon sind.)

### evtl. zusatzaufgabe:

Wäre es möglich, dass von der neuen Variante der Web-Teil hker im Repo unter `/www/<appname>/` landet? 

Falls ja würde ich quasi mal nebenher antesten wollen inwiefern man das für die Web-Version nutzen könnte bzw. ob die positivenAuswirkungen auf die Performance überdeutlich wären – oder schlichtweg als direkter anschaulicher Vergleich zur und Orientierungsmaßstab für die Web-/Live-Version.

Aber wie gesagt: Nur mögliche Zusatzaufgabe, kein Stress.

---

# todo :: concepts
- `apps/collector`
- `apps/downloader` konzepterstellung für ne downloader-app. quasi ne art jDownloader (light) in modern. evtl auf basis von opfs. nicht community-driven, dafür fokus auf erstellen eigener plugins.

---

# notes :: capacitor plugins

- capacitor updater
  - docs: https://capgo.app/plugins/capacitor-updater/
  - repo: https://github.com/Cap-go/capacitor-updater/
- data storage (sqlite)
  - https://capgo.app/plugins/capacitor-data-storage-sqlite/
  - https://github.com/Cap-go/capacitor-data-storage-sqlite/
- capacitor social login
  - docs: https://capgo.app/plugins/capacitor-social-login/
  - repo: https://github.com/Cap-go/capacitor-social-login/
- file
  - https://capgo.app/plugins/capacitor-file/
  - https://github.com/Cap-go/capacitor-file/
- file picker
  - https://capgo.app/plugins/capacitor-file-picker/
  - https://github.com/Cap-go/capacitor-file-picker/
- capacitor native biometric
  - docs: https://capgo.app/plugins/capacitor-native-biometric/
  - repo: https://github.com/Cap-go/capacitor-native-biometric/
- capacitor shake
  - docs: https://capgo.app/plugins/capacitor-shake/
  - repo: https://github.com/Cap-go/capacitor-shake/
- capacitor persistent account
  - docs: https://capgo.app/plugins/capacitor-persistent-account/
  - repo: https://github.com/Cap-go/capacitor-persistent-account/
- zip
  - https://capgo.app/plugins/capacitor-zip/
  - https://github.com/Cap-go/capacitor-zip/

https://capgo.app/plugins/capacitor-device-info/
https://capgo.app/plugins/capacitor-file-compressor/
https://capgo.app/plugins/capacitor-intent-launcher/
https://capgo.app/plugins/capacitor-live-reload/
https://capgo.app/plugins/capacitor-video-thumbnails/
https://capgo.app/plugins/capacitor-widget-kit/
