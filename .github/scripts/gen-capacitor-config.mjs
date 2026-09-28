// .github/scripts/gen-capacitor-config.mjs
//
// writes a Capacitor project scaffold for one app, deterministically and without
// any interactive `cap init` — the counterpart to gen-twa-manifest.mjs on the
// Bubblewrap side, and what makes the Android build runnable in CI (see
// .github/workflows/build-android-capacitor.yml).
//
// by default (build.android: 'capacitor') capacitor serves the webDir that
// stage-capacitor-www.mjs staged, the app's files ship inside the apk.
//
// with LIVE=1 (build.android: 'capacitor-live') the app is wrapped around its
// *live* deployment URL like the TWA: Capacitor's server.url points the webview
// at https://zugriff.dev/<slug>/, and Capacitor still injects its native bridge
// into that remote page, so native plugins (the repo's Saf plugin for folder
// access) work. a persisted SAF folder grant is what the browser File System
// Access API can't give a TWA on Android (it re-confirms every granted folder
// each visit).
//
// it writes into <projectDir>:
//   capacitor.config.json   appId / appName / server.url (live) / android scheme
//   www/index.html          live only: a tiny offline-fallback page (Capacitor
//                           requires a non-empty webDir even when server.url is set)
//
//   APP_SLUG=files node .github/scripts/gen-capacitor-config.mjs build/files
//
// env:
//   APP_SLUG        (required)  the app's registry slug, e.g. "files"
//   SITE_BASE       base url the app is deployed at (default https://zugriff.dev)
//   APP_URL         full app url (default `${SITE_BASE}/${slug}/` — the public
//                   route; vercel rewrites /<slug>/ to /apps/<slug>/, so the
//                   /apps/ path is internal only and 404s if requested directly)
//   LIVE            1 for a live build (build.android: 'capacitor-live')
//   DEVTOOLS        1 for the -dev build: `.dev` on the appId, `(dev)` in the name
//   APP_ID_PREFIX   reverse-dns prefix for the appId (default dev.zugriff)
//
// names and ids by variant come from android.js: Podcasts dev.zugriff.podcasts,
// Podcasts (dev) ….podcasts.dev, Podcasts (live) ….podcasts.live

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registry } from './../../.shared/js/data/apps.js';
import { idOf, nameOf } from './android.js';

const slug = process.env.APP_SLUG;
if (!slug) { console.error('gen-capacitor-config: APP_SLUG is required'); process.exit(1); }

const app = registry.get(slug);
if (!app || app.type !== 'app') { console.error(`gen-capacitor-config: no app "${slug}" in the registry`); process.exit(1); }

const base     = (process.env.SITE_BASE || 'https://zugriff.dev').replace(/\/+$/, '');
const appUrl   = (process.env.APP_URL || `${base}/${slug}/`).replace(/\/*$/, '/');
const outDir   = process.argv[2] || '.';
const live     = process.env.LIVE === '1';
const dev      = process.env.DEVTOOLS === '1';

// the variant, for its id and name (android.js)
const variant = live ? 'capacitor-live' : 'capacitor';

// relative luminance: DARK means light bar icons, for a dark app color
const isLight = (color) => {
  const hex = color.length === 4 ? [...color.slice(1)].map(c => c + c).join('') : color.slice(1, 7);
  const lin = hex.match(/../g)
    .map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.5;
};

const config = {
  appId   : idOf(app, variant, { dev }),
  appName : nameOf(app, variant, { dev }),
  webDir  : 'www',
  server  : {
    ...(live ? { url: appUrl } : {}),   // live: wrap the deployment, exactly like the TWA
    androidScheme  : 'https',
    cleartext      : false,
  },
  plugins : {
    // capacitor 8 runs edge-to-edge. `css` puts the webview under the bars and
    // hands the page its insets (env() plus --safe-area-inset-*), the hint spares
    // a layout jump until the viewport-fit=cover meta tag is read. the style sets
    // the bar icons' contrast from the start; .shared/js/modules/bars.js follows
    // later theme changes
    SystemBars : {
      insetsHandling              : 'css',
      initialViewportFitValueHint : 'cover',
      style                       : isLight(app.color) ? 'LIGHT' : 'DARK',
    },
  },
};

// offline fallback: shown only if the device is offline on first launch (with a
// live server.url the webview otherwise loads the real site straight away).
const fallback = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${config.appName}</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font:16px system-ui;background:${app.color};color:#f8f8f2">
  <p style="opacity:.7">Offline — reconnect to open ${config.appName}.</p>
</body>`;

await mkdir(join(outDir, 'www'), { recursive: true });
await writeFile(join(outDir, 'capacitor.config.json'), JSON.stringify(config, null, 2) + '\n');
if (live) await writeFile(join(outDir, 'www', 'index.html'), fallback);

console.log(`gen-capacitor-config: wrote ${join(outDir, 'capacitor.config.json')}`);
console.log(`  appId ${config.appId}  ·  ${live ? `url ${config.server.url}` : 'staged www/'}`);
