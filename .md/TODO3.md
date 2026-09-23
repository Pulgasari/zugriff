# todo

## `apps/code`
- [ ] geteilter editor-panel um mehrere files nebeneinander einzusehen/bearbeiten
- [ ] files in der fileList sticky machen können
- [ ] editor-settings je filetype/ext setzbar

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

# apps (capacitor builds for android)

- [ ] aktuell sind die spaces ober- und unterhalb des app-screens bei den android-capacitor-apps schwarz anstatt bg-farbe des themes zu haben. wenn ich mich recht erinnere, sollte das gerade durch capacitor fixbar sein?
- [ ] die android-apps haben alle das default-capacitor-icon, sollten aber eigtl. alle ihr eigenes haben


```
// the iconify svg api serves one file per `prefix:name`, and a given name is effectively
// immutable. cache each icon hard (long ttl, no network within it) so the public api is hit
// once and then not again — uncached, every <aufbau-icon> re-requests it on each render until
// the api answers 429, and a 429 carries no access-control-allow-origin, which is what makes a
// mask-image (loaded cross-origin in cors mode) fail its cors check in the console.
```

