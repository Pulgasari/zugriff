# scripts

## `gen-app-assets.mjs`

- auto-generate each app's `assets` directory (icons)
- auto-generate each app's `manifest.json` from its `shared/js/registry.js` entry

## `get-autopack-apps.js`

Gibt ein JSON-Array der App-Slugs aus, die in `shared/js/registry.js` mit
`autopack: true` markiert sind — die Liste, die der Android-Build als Matrix
verwendet. Aktuell: `podcasts`, `notes` (Testumfang).

## `gen-twa-manifest.mjs`

Schreibt für **eine** App eine Bubblewrap-`twa-manifest.json`, deterministisch
und **ohne** Bubblewraps interaktives `init` — genau das macht den Build in CI
möglich. Nutzt `@bubblewrap/core`'s `TwaManifest.fromWebManifest()` (holt das
live Web-App-Manifest der App) und überschreibt nur `packageId` und den Signing-
Key. Wird vom Workflow pro App aufgerufen.

## `get-capacitor-apps.js`

Gibt ein JSON-Array der App-Slugs aus, die in `shared/js/registry.js` mit
`capacitor: true` markiert sind — die Matrix des **Capacitor**-Builds. Bewusst
getrennt von `autopack` (dem TWA-Flag), sodass eine App als TWA, als
Capacitor-App, als beides oder als keins gepackt werden kann. Aktuell: `files`,
`notes` (Testumfang).

## `gen-capacitor-config.mjs`

Das Capacitor-Gegenstück zu `gen-twa-manifest.mjs`: schreibt für **eine** App
ein `capacitor.config.json` (+ ein `www/index.html` als Offline-Fallback, weil
Capacitor ein nicht-leeres `webDir` verlangt) — deterministisch und ohne
interaktives `cap init`. Wie die TWA wird die App um ihre **Live-URL** gewickelt
(`server.url = https://zugriff.dev/apps/<slug>/`) statt ihre Dateien zu bundlen;
Capacitor injiziert seine native Bridge trotzdem in die Remote-Seite, sodass
`@capacitor/filesystem` funktioniert. `appId` ist `dev.zugriff.<slug>` — identisch
zu den TWA-`packageId`s, teilt sich also dieselbe `/.well-known/assetlinks.json`.

---

## Capacitor-Build: `.github/workflows/build-capacitor.yml`

Das Gegenstück zu `build-android.yml`. Verpackt die als `capacitor: true`
markierten PWAs als Android-Apps (**APK + AAB**) — ein Matrix-Job pro App.

**Warum zusätzlich zur TWA:** Eine TWA ist nur Chrome, also gilt dort die
Browser-**File System Access API** — und die lässt Android bei jedem Besuch jeden
freigegebenen Ordner neu bestätigen, was das „Ordner einmal freigeben und
browsen"-Modell der Folder-Apps kaputt macht. Ein Capacitor-Wrapper bringt
stattdessen eine native Filesystem-Bridge (`@capacitor/filesystem`) mit, deren
**SAF-Freigabe persistiert** wird. Die geteilte Filesystem-Ebene
(`.shared/js/filesystem/`) erkennt die Capacitor-Laufzeit und nutzt automatisch
das native FS (siehe `platform.js` + `cap-fs.js`).

**Ablauf** (pro App): JDK 17 + Android SDK → Wegwerf-Keystore → Capacitor-Projekt
scaffolden (`gen-capacitor-config.mjs` → `npm i @capacitor/{core,cli,android,
filesystem}` + `@capawesome/capacitor-file-picker` → `cap add android` →
`cap sync`) → `gradlew bundleRelease assembleRelease` → APK/AAB **signieren**
(Capacitor baut unsigniert: `zipalign`+`apksigner` für die APK, `jarsigner` für
die AAB) → als Artefakt hochladen. Ausgelöst per `workflow_dispatch` und bei Push
auf `main`, wenn Registry/Filesystem-Ebene/Build-Skripte sich ändern.

Der **stabile Signing-Key**-TODO aus `build-android.yml` gilt hier genauso — die
`appId`s folgen `dev.zugriff.<slug>`, teilen sich also die Root-Datei
`/.well-known/assetlinks.json` mit den TWA-Builds.

---

## Android-Build: `.github/workflows/build-android.yml`

Verpackt die als `autopack: true` markierten PWAs als Android-Apps (**APK +
AAB**) — eine Matrix-Job pro App.

**Ablauf:**

1. **`discover-apps`** — `get-autopack-apps.js` liest die Registry und gibt die
   Slugs als JSON aus.
2. **`build-android`** (Matrix, ein Job je Slug) — jede App wird als **Trusted
   Web Activity** um ihre Live-Deployment-URL gewickelt, mit **Bubblewrap**
   (Googles offiziellem TWA-Tool, auf dem auch PWABuilder aufsetzt):
   JDK 17 + Android SDK einrichten → Bubblewrap installieren → `twa-manifest.json`
   via `gen-twa-manifest.mjs` erzeugen → `bubblewrap update` (Projekt
   scaffolden) → `bubblewrap build` → APK **und** AAB als Artefakt hochladen.

Ausgelöst wird er per **`workflow_dispatch`** (manuell) und bei Push auf `main`,
wenn Registry/Manifeste/Build-Skripte sich ändern.

> Hinweis: Das ursprünglich angedachte `pwa-builder/pwabuilder-action` existiert
> nicht (404). Deshalb wird Bubblewrap direkt angesteuert.

### Origin

Die TWA wird an die Origin des Manifest-URLs gebunden — aktuell
`https://zugriff.dev` (im Workflow als `SITE_BASE`). Ändert sich der Deploy-Host,
muss das dort angepasst werden.

### ⚠️ TODO: stabiler Signing-Key

Der Test-Build erzeugt **pro Lauf einen Wegwerf-Keystore**. Die Artefakte taugen
nur zum „baut es / lässt es sich zum Testen installieren" — **nicht** für den
Play Store und **nicht** für stabile App-Identität / Digital Asset Links.

Für echte Builds:

- einen Android-Keystore je App (oder einen gemeinsamen) anlegen und
  `base64`-kodiert + Passwörter als **Repo-Secrets** hinterlegen,
- im Workflow den „throwaway keystore"-Schritt durch einen Decode-Schritt +
  `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` aus Secrets ersetzen,
- die Signing-**SHA-256** jeder App in die **eine** Root-Datei
  `/.well-known/assetlinks.json` eintragen (liegt im Repo-Root; enthält schon die
  manuell gebauten `dev.zugriff.ebooks` + `dev.zugriff.notes`) — das entfernt die
  Browser-URL-Leiste in der App. Die Package-IDs folgen `dev.zugriff.<slug>`.

## `img-proxy.php`

Server-seitiger Bild-Resizer (siehe podcasts).
