# todo

## apps (allgemein)

- [x] `app.html` mit `index.html` vereinigen (zu `index.htnl`) + `vercel.json` dementsprechend anpassen
- [x] in `index.html` bzw `.shared/js/boot.js` die starttransition solider und nicer machen (ich denke sollte smoother sein, nix mit layoutshifting sondern eher so chilliges einblenden)
- [x] alle apps in `/apps` aufs neue muster der runtime, imports, module, components/views usw umstellen

## service worker (`.shared/js/service.js`)
- [x] sollte auch zeug von `https://code.pulgasari.dev/*` cachen (staleWhileRevalidate, ist in entwicklung, verändert sich öfters) — eigener `zugriff-dev-*` cache, ttl 0, cached-first + revalidate
- [x] sollte zeug von `esm.sh` und co dauerhaft/aggressiv cachen (quasi nur erneuern wenn version höher, aber konkrete version is unveränderlich) — voller semver auf esm.sh/unpkg/jsdelivr = immutable (1 jahr), lockere pins wie `music-metadata@11` werden trotzdem gecached, nur revalidiert

## apps (builds)

- [x] signatur von `autopack: true` bzw. `capacitor: true` in `.shared/js/data/apps.js` ändern zu `build: { android: 'capacitor' }` bzw. `build: { android: 'bubblewrap' }` — capacitor: audio-manager, code, ebooks, files, images, notes, videos · bubblewrap: feeds, icons, podcasts. discover-skripte + workflows nachgezogen (`get-autopack-apps.js` → `get-bubblewrap-apps.js`)
- [x] generell mal kontrollieren, ob das aktuell überhaupt gebuildet wird. ich kanns zumindest nirgendwo ne apk finden. — ursache: die skripte importierten das alte `.shared/js/registry.js` (heute `data/apps.js`) → discover brach ab, es entstand nie eine apk. pfade gefixt. ausserdem werden per `workflow_dispatch` heavy builds nur manuell ausgelöst (Actions-tab). apks landen jetzt gesammelt in einem artefakt pro lauf (`android-all` / `capacitor-all`)
- [~] dieses secret-key bzgl. app-signing einrichten — mechanik steht: workflows dekodieren einen keystore aus repo-secrets (fallback = wegwerf-key). offen (deine seite): 4 secrets anlegen + sha-256 in `/.well-known/assetlinks.json` eintragen. schritt-für-schritt in `.github/scripts/README.md` → abschnitt „Signing-Key"

vermutlich werden die apps fortan aber fortan für android generell mit capacitor gebaut, weil das scheinbar vieles erleichtert. (ich habe aber noch nicht vollständig capacitor durchdrungen, aber bei dem was ich bisher so las...)

- [ ] beim runnen des capacitor-workflows kommen folgende warnungen:
```
9 warnings

Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
build-capacitor (files)
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-java@v4, actions/setup-node@v4, actions/upload-artifact@v4, android-actions/setup-android@v3. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
build-capacitor (files)
setup-java v4 is deprecated and will no longer receive updates. Please migrate to actions/setup-java@v5.
build-capacitor (notes)
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-java@v4, actions/setup-node@v4, actions/upload-artifact@v4, android-actions/setup-android@v3. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
build-capacitor (notes)
setup-java v4 is deprecated and will no longer receive updates. Please migrate to actions/setup-java@v5.
build-capacitor (videos)
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-java@v4, actions/setup-node@v4, actions/upload-artifact@v4, android-actions/setup-android@v3. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
build-capacitor (videos)
setup-java v4 is deprecated and will no longer receive updates. Please migrate to actions/setup-java@v5.
build-capacitor (ebooks)
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-java@v4, actions/setup-node@v4, actions/upload-artifact@v4, android-actions/setup-android@v3. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
build-capacitor (ebooks)
setup-java v4 is deprecated and will no longer receive updates. Please migrate to actions/setup-java@v5.
```
