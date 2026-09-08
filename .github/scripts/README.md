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
`.shared/js/data/apps.js` `build.android === 'capacitor'` setzt — die Matrix des
**Capacitor**-Builds. Jede App zielt auf genau einen Android-Builder
(`capacitor` oder `bubblewrap`). Die konkrete Liste ergibt sich aus der Registry.
Ist `APP_FILTER` gesetzt (der `app`-Dispatch-Input), wird auf genau diesen Slug
eingegrenzt.

## `gen-capacitor-config.mjs`

Das Capacitor-Gegenstück zu `gen-twa-manifest.mjs`: schreibt für **eine** App
ein `capacitor.config.json` (+ ein `www/index.html` als Offline-Fallback, weil
Capacitor ein nicht-leeres `webDir` verlangt) — deterministisch und ohne
interaktives `cap init`. Wie die TWA wird die App um ihre **Live-URL** gewickelt
(`server.url = https://zugriff.dev/<slug>/`) statt ihre Dateien zu bundlen;
Capacitor injiziert seine native Bridge trotzdem in die Remote-Seite, sodass
`@capacitor/filesystem` funktioniert. `appId` ist `dev.zugriff.<slug>` — identisch
zu den TWA-`packageId`s, teilt sich also dieselbe `/.well-known/assetlinks.json`.

---

## Das `build`-Feld in der Registry

Der Ziel-Builder einer App steht in ihrem Eintrag in `.shared/js/data/apps.js`:

```js
build: { android: 'capacitor' }   // oder 'bubblewrap'
```

Fehlt das Feld, wird die App für Android nicht gebaut. Jede App zielt auf genau
einen Builder — die beiden Discover-Skripte oben lesen dieses Feld und liefern
die jeweilige Build-Matrix.

---

## Capacitor-Build: `.github/workflows/build-capacitor.yml`

Das Gegenstück zu `build-android.yml`. Verpackt die PWAs mit
`build.android: 'capacitor'` als Android-Apps (**APK + AAB**) — ein Matrix-Job
pro App.

**Warum zusätzlich zur TWA:** Eine TWA ist nur Chrome, also gilt dort die
Browser-**File System Access API** — und die lässt Android bei jedem Besuch jeden
freigegebenen Ordner neu bestätigen, was das „Ordner einmal freigeben und
browsen"-Modell der Folder-Apps kaputt macht. Ein Capacitor-Wrapper bringt
stattdessen eine native Filesystem-Bridge (`@capacitor/filesystem`) mit, deren
**SAF-Freigabe persistiert** wird. Die geteilte Filesystem-Ebene
(`.shared/js/filesystem/`) erkennt die Capacitor-Laufzeit und nutzt automatisch
das native FS (siehe `platform.js` + `cap-fs.js`).

**Ablauf** (pro App): JDK 17 + Android SDK → Signing-Key bereitstellen →
Capacitor-Projekt scaffolden (`gen-capacitor-config.mjs` → `npm i
@capacitor/{core,cli,android,filesystem}` + `@capawesome/capacitor-file-picker` →
`cap add android` → `cap sync`) → `gradlew bundleRelease assembleRelease` →
APK/AAB **signieren** (Capacitor baut unsigniert: `zipalign`+`apksigner` für die
APK, `jarsigner` für die AAB) → als Artefakt hochladen. Ausgelöst **manuell** per
`workflow_dispatch`; der optionale `app`-Input baut nur einen einzelnen Slug
statt der ganzen Matrix.

---

## Android-Build: `.github/workflows/build-android.yml`

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

Jeder Matrix-Job lädt sein `*-<slug>`-Artefakt hoch; ein abschließender
`collect`-Job sammelt alle in **ein** Artefakt pro Lauf:

- `android-all`   (Bubblewrap-Workflow) — je App ein `android-<slug>/`-Ordner
- `capacitor-all` (Capacitor-Workflow)  — je App ein `capacitor-<slug>/`-Ordner

Zu finden unter dem jeweiligen Run im **Actions**-Tab, Abschnitt „Artifacts".
Artefakte laufen nach der Retention ab (Einzel-Artefakte 14 Tage, das
gesammelte 30 Tage) — für dauerhafte Ablage die APKs herunterladen oder auf ein
GitHub Release heben.

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

Diese SHA-256 je App-`package_name` (`dev.zugriff.<slug>`) in die **eine**
Root-Datei `/.well-known/assetlinks.json` eintragen (enthält schon die manuell
gebauten `dev.zugriff.ebooks` + `dev.zugriff.notes`). Da alle Apps denselben Key
teilen, ist die SHA-256 für alle Einträge identisch.

## `img-proxy.php`

Server-seitiger Bild-Resizer (siehe podcasts).
