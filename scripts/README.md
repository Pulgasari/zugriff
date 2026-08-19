# scripts

## `gen-app-assets.mjs`

- auto-generate `assets` directory
- auto-generate `manifest.json`

## `get-autopack-apps.js`

Gibt ein JSON-Array der aktiven App-Slugs für GitHub Actions aus.

---

## 3. Dynamischer Workflow: `.github/workflows/build-android.yml`

​Dieser Workflow führt zuerst das Skript aus, um die Liste der zu bauenden Apps zu ermitteln. Danach baut er in Phase 2 alle betroffenen Apps parallel über eine GitHub Matrix.

```yaml
name: Build Android PWA Packages

on:
  push:
    branches:
      - main

jobs:
  # Job 1: Parse registry.js and extract target apps
  discover-apps:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.parse.outputs.apps }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Extract Autopack Apps
        id: parse
        run: node scripts/get-autopack-apps.js

  # Job 2: Build packages in parallel for each extracted slug
  build-android:
    needs: discover-apps
    if: ${{ needs.discover-apps.outputs.apps != '[]' && needs.discover-apps.outputs.apps != '' }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: ${{ fromJson(needs.discover-apps.outputs.apps) }}
    steps:
      - uses: actions/checkout@v4

      - name: Generate Android App for ${{ matrix.app }}
        uses: pwa-builder/pwabuilder-action@v1.0.1
        with:
          manifest-url: 'https://code.pulgasari.dev/zugriff/apps/${{ matrix.app }}/manifest.json'
          output-type: 'aab'

      - name: Upload Artifact for ${{ matrix.app }}
        uses: actions/upload-artifact@v4
        with:
          name: android-build-${{ matrix.app }}
          path: ./*.aab
```
