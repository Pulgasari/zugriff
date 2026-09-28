# scripts

## `gen-app-assets.mjs`

- auto-generate each app's `assets` directory (icons)
- auto-generate each app's `manifest.json` from its `.shared/js/data/apps.js` entry

## `get-bubblewrap-apps.js`

Gibt ein JSON-Array der App-Slugs aus, deren Registry-Eintrag in
`.shared/js/data/apps.js` `build.android === 'bubblewrap'` setzt — die Matrix des
TWA/Bubblewrap-Builds. Die konkrete Liste ergibt sich aus der Registry (aktuell
keine App — alle buildbaren zielen auf capacitor). Ist `APP_FILTER` gesetzt (der
`app`-Dispatch-Input), wird auf genau diesen Slug eingegrenzt.

## `gen-twa-manifest.mjs`

Schreibt für **eine** App eine Bubblewrap-`twa-manifest.json`, deterministisch
und **ohne** Bubblewraps interaktives `init` — genau das macht den Build in CI
möglich. Nutzt `@bubblewrap/core`'s `TwaManifest.fromWebManifest()` (holt das
live Web-App-Manifest der App) und überschreibt nur `packageId` und den Signing-
Key. Wird vom Workflow pro App aufgerufen.

## `get-capacitor-apps.js`

Gibt ein JSON-Array der App-Slugs aus, deren Registry-Eintrag in
`.shared/js/data/apps.js` die Variante `BUILDER` enthält (`capacitor` oder
`capacitor-live`) — die Matrix der beiden **Capacitor**-Builds. Ist `APP_FILTER`
gesetzt (der `app`-Dispatch-Input), wird auf genau diesen Slug eingegrenzt.

## `gen-capacitor-config.mjs`

Das Capacitor-Gegenstück zu `gen-twa-manifest.mjs`: schreibt für **eine** App
ein `capacitor.config.json` — deterministisch und ohne interaktives `cap init`.
Standardmäßig liefert Capacitor das von `stage-capacitor-www.mjs` gestagete
`www/` aus. Mit `LIVE=1` wird die App wie die TWA um ihre **Live-URL** gewickelt
(`server.url = https://zugriff.dev/<slug>/`, dazu ein `www/index.html` als
Offline-Fallback, weil Capacitor ein nicht-leeres `webDir` verlangt); Capacitor
injiziert seine native Bridge trotzdem in die Remote-Seite, sodass native Plugins
(das eigene Saf-Plugin) funktionieren. `appId` und Name kommen aus `android.js`
(siehe „Namen, IDs, Dateien“).

## `stage-capacitor-www.mjs`

Stellt für den Capacitor-Build (`build.android: 'capacitor'`) das `www/` zusammen,
das ins APK kommt (`APP_SLUG=podcasts PKG_SOURCE=build/_pkg node .github/scripts/stage-capacitor-www.mjs build/podcasts`).

Die Arbeit macht **`@aufbau/bundler`** (`aufbau/bundler/`) mit der
`bundler.config.js` aus dem Repo-Root. Der Bundler kommt aus dem aufbau-Checkout
unter den Paketen (fehlt er, wird aufbau geklont), ist also dasselbe aufbau, mit
dem die App gebündelt wird. Die Config legt fest:

- `index.html`, `icon.svg`, `logo.svg` und `.shared/` aus dem Repo-Root,
  `apps/<slug>/` als `www/<slug>/` (dort, wo es der Vercel-Rewrite live hinlegt)
- die first-party Pakete, die `code.pulgasari.dev` ausliefert (aufbau, domina,
  bunker, htx, js-packages …), als `www/_pkg/<repo>/`; fehlende werden aus
  `github.com/Pulgasari/<repo>` geklont, jedes `https://code.pulgasari.dev` zeigt
  danach auf `/_pkg`, auch die Importmap aus `boot.js`
- die Module von Dritten (esm.sh, jsdelivr, unpkg) als `www/_vendor/…`: der Bundler
  liest jede URL als npm-Paket, installiert es aus der npm-Registry (jsr über
  npm.jsr.io) und baut mit esbuild ein Browser-Modul daraus. Die Einträge der
  Importmap aus `boot.js` kommen als `window.__BOOT_CONFIG__.imports` in die
  `index.html`, ausgeschriebene URLs werden direkt ersetzt
- die Icons, die im Code vorkommen, als SVGs in `www/_icons/provide.js`, das sie
  `<aufbau-icon>` per `AufbauIcon.provide()` übergibt; die iconify-API braucht es
  nur noch für Namen, die erst zur Laufzeit entstehen
- von den Webfonts nur die, die CSS und JS beim Namen nennen (Manrope, JetBrains
  Mono), weitere über `keep` in der Config; der Katalog und damit die Settings
  bieten nur diese an
- `/` wird beim Start zu `/<slug>/`: Capacitor öffnet `https://localhost/`, und die
  Shell liest die Route aus dem Pfad
- zum Schluss fliegt alles raus, was von der `index.html` aus nicht erreicht wird
  (Imports, Importmap, CSS, Pfade in Strings). Komponenten, die per
  `zugriff.component('Name')` geladen werden, bleiben einzeln (`loaders` in der
  Config), die App selbst bleibt ganz, aufbaus `css/` deklariert aufbau selbst.
  `BUNDLER_WHY=<pfad>` zeigt, warum eine Datei drin ist

Am Ende steht die Zusammenfassung des Bundlers: welche Pakete und Module lokal
sind, die Größe und was **weiter übers Netz** geht (Icons, APIs …), in CI
auch in der Step-Summary. Das ist die Liste, die die nächsten Schritte des
Bundlers abarbeiten (siehe `aufbau/bundler/concept.md`).

### Devtools und `-dev`-Builds

`export const devtools` in `bundler.config.js` schaltet für den Capacitor-Build
(`capacitor`) einen zweiten Build pro App zu: mit `@aufbau/devtools` und eruda,
geöffnet mit `?dev`, als eigene App `Podcasts (dev)` (`dev.zugriff.<slug>.dev`),
also parallel installierbar. Der normale Build lässt die Devtools weg (`exclude`
in prune), nur der kleine Recorder aus `@aufbau/devtools/recorder.js` bleibt.

## `gen-capacitor-res.mjs`

Läuft nach `cap add android` und ersetzt die Ressourcen des Capacitor-Templates
durch die der App (`APP_SLUG=files node .github/scripts/gen-capacitor-res.mjs build/files`):

- **Launcher-Icons** aus `apps/<slug>/app.svg`: legacy (`ic_launcher`,
  `ic_launcher_round`) und adaptiv (`ic_launcher_foreground` + Hintergrundfarbe).
  Ein vollflächiges Hintergrund-`<rect>` im SVG wird für den Vordergrund entfernt,
  der Hintergrund kommt als eigene Ebene in der App-Farbe.
- **Status- und Navigationsleiste** in der App-Farbe statt schwarz (DayNight-
  Default des Templates), Icon-Kontrast per Luminanz.
- **Launch-Screen** in der App-Farbe statt `@drawable/splash` (Capacitor-Logo).

Die Farbe ist `color` aus der Registry, derselbe Wert wie `theme_color` im
Manifest. Braucht `sharp` aus der `package.json` im Repo-Root.

**Edge-to-Edge (Capacitor 8, `targetSdk` 36):** Android 15+ ignoriert die
Leistenfarben. Das WebView läuft unter die Leisten (`SystemBars` in
`capacitor.config.json`, `viewport-fit=cover`), `html` malt `var(--bg)` dahinter
und `#app` hält per `env(safe-area-inset-*)` Abstand (`.shared/css/theme.css`).
Die Leisten haben so automatisch die Theme-Farbe. Den Icon-Kontrast setzt
`.shared/js/modules/bars.js` über das eingebaute `SystemBars`-Plugin bei jedem
Theme-Wechsel. Die Farben aus diesem Skript bleiben Fallback für ältere
Android-Versionen und ältere WebViews (< Chromium 140), bei denen Capacitor das
WebView nativ einrückt.

## `add-capacitor-plugins.mjs`

Kopiert die eigenen nativen Plugins aus `.github/capacitor/plugins/*.java` in das
gescaffoldete Android-Projekt (Ziel-Ordner aus der `package`-Zeile) und
registriert sie in `MainActivity` (`registerPlugin(...)` vor `super.onCreate`).
npm-Plugins findet `cap sync` selbst, diese hier nicht. Aktuell: `SafPlugin`
(Ordnerzugriff über SAF, als `Capacitor.Plugins.Saf`).

---

## Das `build`-Feld in der Registry

Der Ziel-Builder einer App steht in ihrem Eintrag in `.shared/js/data/apps.js`:

```js
build: { android: 'capacitor' }                     // eine Variante
build: { android: ['capacitor-live', 'capacitor'] }  // mehrere
```

Fehlt das Feld, wird die App für Android nicht gebaut. Die Discover-Skripte
lesen es und liefern die jeweilige Build-Matrix (`get-capacitor-apps.js` mit
`BUILDER` für beide Capacitor-Varianten), `android.js` hält die Regeln dazu.

### Namen, IDs, Dateien

`android.js` hält die Regeln. Nur der gebündelte Capacitor-Build ist die App
selbst, jede andere Variante trägt ein Kürzel in Name, ID und Datei, so lassen
sich alle nebeneinander installieren:

| Variante          | Name              | ID                          | Datei                            |
|-------------------|-------------------|-----------------------------|----------------------------------|
| `capacitor`       | `Podcasts`        | `dev.zugriff.podcasts`      | `podcasts-202612011212.apk`      |
| `capacitor` + dev | `Podcasts (dev)`  | `dev.zugriff.podcasts.dev`  | `podcasts-202612011212-dev.apk`  |
| `capacitor-live`  | `Podcasts (live)` | `dev.zugriff.podcasts.live` | `podcasts-202612011212-live.apk` |
| `bubblewrap`      | `Podcasts (bw)`   | `dev.zugriff.podcasts.bw`   | `podcasts-202612011212-bw.apk`   |

Der Stempel ist die Minute, in der der Lauf startet (Berliner Zeit), für alle
Builds eines Laufs derselbe. Dazu jeweils die `.aab`.

| Wert             | Workflow                           | App im APK |
|------------------|------------------------------------|------------|
| `bubblewrap`     | `build-android-bubblewrap.yml`     | TWA um die Live-URL |
| `capacitor-live` | `build-android-capacitor-live.yml` | WebView auf die Live-URL (`server.url`) |
| `capacitor`      | `build-android-capacitor.yml`      | die Dateien selbst, aus `www/` |

---

## Capacitor-Build: `.github/workflows/build-android-capacitor.yml`

Verpackt die Apps mit `build.android: 'capacitor'` als Android-Apps (**APK +
AAB**) — ein Matrix-Job pro App. Die Dateien der App liegen im APK:
`stage-capacitor-www.mjs` stellt vor dem Scaffolding das `www/` zusammen,
`capacitor.config.json` hat kein `server.url`.

**Warum Capacitor statt TWA:** Eine TWA ist nur Chrome, also gilt dort die
Browser-**File System Access API** — und die lässt Android bei jedem Besuch jeden
freigegebenen Ordner neu bestätigen, was das „Ordner einmal freigeben und
browsen"-Modell der Folder-Apps kaputt macht. Ein Capacitor-Wrapper bringt
stattdessen das eigene **Saf-Plugin** mit (`.github/capacitor/plugins/SafPlugin.java`),
das Ordner über das Storage Access Framework liest und die **Freigabe
persistiert**. `@capacitor/filesystem` taugt dafür nicht: es lehnt `content://`-URIs
für `readdir` und alle Schreiboperationen ab. Die geteilte Filesystem-Ebene
(`.shared/js/modules/filesystem/`) erkennt die Capacitor-Laufzeit und nutzt
automatisch das Plugin (siehe `platform.js`). Ebenso fällt dort der CORS-Proxy weg:
`.shared/js/modules/http.js` und `thumbs.js` holen über das native `CapacitorHttp`.

**Ablauf** (pro App): Node 22 + JDK 21 + Android SDK 36 → Signing-Key bereitstellen →
`www/` stagen (`stage-capacitor-www.mjs`, nicht bei live) → Capacitor-Projekt
scaffolden (`gen-capacitor-config.mjs` → `npm i @capacitor/{core,cli,android}` →
`cap add android` → `cap sync`) → Ressourcen und eigene Plugins
(`gen-capacitor-res.mjs`, `add-capacitor-plugins.mjs`) → `gradlew bundleRelease
assembleRelease` → APK/AAB **signieren** (Capacitor baut unsigniert:
`zipalign`+`apksigner` für die APK, `jarsigner` für die AAB) → als Artefakt
hochladen. Ausgelöst **manuell** per `workflow_dispatch`; der optionale
`app`-Input baut nur einen einzelnen Slug statt der ganzen Matrix.

Noch nicht offline: alles, was nicht von `code.pulgasari.dev` kommt (esm.sh,
jsdelivr, unpkg, Icons, APIs). Die Step-Summary jedes Laufs listet es.

---

## Capacitor-Live-Build: `.github/workflows/build-android-capacitor-live.yml`

Ruft `build-android-capacitor.yml` mit `live: true` auf, für die Apps mit
`build.android: 'capacitor-live'`: kein `www/`-Staging, stattdessen zeigt
`server.url` auf die Live-URL. Gleiche Toolchain, gleiches Signing, gleiche
Plugins.

---

## Bubblewrap-Build: `.github/workflows/build-android-bubblewrap.yml`

Verpackt die PWAs mit `build.android: 'bubblewrap'` als Android-Apps (**APK +
AAB**) — ein Matrix-Job pro App.

**Ablauf:**

1. **`discover-apps`** — `get-bubblewrap-apps.js` liest die Registry und gibt die
   Slugs als JSON aus.
2. **`build-android`** (Matrix, ein Job je Slug) — jede App wird als **Trusted
   Web Activity** um ihre Live-Deployment-URL gewickelt, mit **Bubblewrap**
   (Googles offiziellem TWA-Tool, auf dem auch PWABuilder aufsetzt):
   JDK 17 + Android SDK einrichten → Bubblewrap installieren → `twa-manifest.json`
   via `gen-twa-manifest.mjs` erzeugen → `bubblewrap update` (Projekt
   scaffolden) → `bubblewrap build` → APK **und** AAB als Artefakt hochladen.

Ausgelöst wird er **manuell** per `workflow_dispatch` (Actions-Tab → Workflow
auswählen → „Run workflow"). Der optionale `app`-Input baut nur einen einzelnen
Slug statt der ganzen Matrix. Ein Commit baut absichtlich nicht.

> Hinweis: Das ursprünglich angedachte `pwa-builder/pwabuilder-action` existiert
> nicht (404). Deshalb wird Bubblewrap direkt angesteuert.

### Origin

Die TWA wird an die Origin des Manifest-URLs gebunden — aktuell
`https://zugriff.dev` (im Workflow als `SITE_BASE`). Ändert sich der Deploy-Host,
muss das dort angepasst werden.

### Wo landen die APKs?

Jede APK und jede AAB ist ein eigenes Artefakt, **ungezippt** (`archive: false`)
und nach der Datei benannt, also z. B. `podcasts-202612011212.apk` — der Download
ist direkt die Datei. Zu finden unter dem jeweiligen Run im **Actions**-Tab,
Abschnitt „Artifacts". Sie laufen nach 14 Tagen ab — für dauerhafte Ablage
herunterladen oder auf ein GitHub Release heben.

---

## Signing-Key

Beide Workflows signieren gleich. Ohne Secrets erzeugen sie **pro Lauf einen
Wegwerf-Keystore** — die Artefakte taugen nur zum „baut es / lässt es sich zum
Testen installieren", **nicht** für den Play Store und **nicht** für stabile
App-Identität / Digital Asset Links (die SHA-256 ändert sich bei jedem Lauf).

Für stabile, signierte Builds vier **Repo-Secrets** hinterlegen
(Settings → Secrets and variables → Actions → New repository secret):

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64`   | der Keystore, base64-kodiert |
| `ANDROID_KEYSTORE_PASSWORD` | Store-Passwort |
| `ANDROID_KEY_PASSWORD`      | Key-Passwort |
| `ANDROID_KEY_ALIAS`         | Alias im Keystore |

Sind sie gesetzt, dekodiert der Schritt „Provide the signing key" den Keystore
und signiert damit; fehlen sie, fällt er auf den Wegwerf-Key zurück (CI bleibt
also grün, auch ohne Secrets).

**Keystore einmalig erzeugen** (ein gemeinsamer Key für alle Apps reicht, da die
`packageId`/`appId` je App unterschiedlich ist):

```sh
keytool -genkeypair -v \
  -keystore zugriff-release.keystore -alias zugriff \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass '<STORE_PASS>' -keypass '<KEY_PASS>' \
  -dname "CN=zugriff, O=pulgasari, C=DE"

# base64 für das Secret (eine Zeile)
base64 -w0 zugriff-release.keystore   # linux
base64      zugriff-release.keystore  # macos
```

Dann `ANDROID_KEY_ALIAS = zugriff`, `ANDROID_KEYSTORE_PASSWORD = <STORE_PASS>`,
`ANDROID_KEY_PASSWORD = <KEY_PASS>`, und den base64-Blob als
`ANDROID_KEYSTORE_BASE64`. Den Keystore **nicht** ins Repo committen, nur lokal
sicher aufbewahren (Verlust = keine Updates der veröffentlichten Apps mehr).

**Digital Asset Links** (entfernt die Browser-URL-Leiste in der App): Jeder Build
loggt im Schritt „Print signing SHA-256" den Fingerprint des Signer-Zertifikats.
Denselben Wert liefert lokal:

```sh
keytool -list -v -keystore zugriff-release.keystore -alias zugriff \
  -storepass '<STORE_PASS>' | grep SHA256
```

Diese SHA-256 je App-`package_name` der TWA-Builds (`dev.zugriff.<slug>.bw`) in
die **eine** Root-Datei `/.well-known/assetlinks.json` eintragen (enthält noch die
früher manuell gebauten `dev.zugriff.ebooks` + `dev.zugriff.notes`). Da alle Apps
denselben Key teilen, ist die SHA-256 für alle Einträge identisch.

## `img-proxy.php`

Server-seitiger Bild-Resizer (siehe podcasts).
