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
`https://code.pulgasari.dev/zugriff` (im Workflow als `SITE_BASE`). Ändert sich
der Deploy-Host, muss das dort angepasst werden.

### ⚠️ TODO: stabiler Signing-Key

Der Test-Build erzeugt **pro Lauf einen Wegwerf-Keystore**. Die Artefakte taugen
nur zum „baut es / lässt es sich zum Testen installieren" — **nicht** für den
Play Store und **nicht** für stabile App-Identität / Digital Asset Links.

Für echte Builds:

- einen Android-Keystore je App (oder einen gemeinsamen) anlegen und
  `base64`-kodiert + Passwörter als **Repo-Secrets** hinterlegen,
- im Workflow den „throwaway keystore"-Schritt durch einen Decode-Schritt +
  `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` aus Secrets ersetzen,
- die Signing-**SHA-256** je App unter
  `apps/<slug>/.well-known/assetlinks.json` auf der Site veröffentlichen (entfernt
  die Browser-URL-Leiste in der App).

## `img-proxy.php`

Server-seitiger Bild-Resizer (siehe podcasts).
