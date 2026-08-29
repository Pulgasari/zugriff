// .github/scripts/gen-capacitor-config.mjs
//
// writes a Capacitor project scaffold for one app, deterministically and without
// any interactive `cap init` — the counterpart to gen-twa-manifest.mjs on the
// Bubblewrap side, and what makes the Android build runnable in CI (see
// .github/workflows/build-capacitor.yml).
//
// like the TWA, the app is wrapped around its *live* deployment URL rather than
// bundling its static files: Capacitor's server.url points the webview at
// https://zugriff.dev/apps/<slug>/, and Capacitor still injects its native
// bridge into that remote page, so @capacitor/filesystem (and the SAF picker)
// work — which is the whole point. that native filesystem is what the browser
// File System Access API can't give a TWA on Android (it re-confirms every
// granted folder each visit); the SAF grant a Capacitor app takes is persisted.
//
// it writes two things into <projectDir>:
//   capacitor.config.json   appId / appName / server.url / android scheme
//   www/index.html          a tiny offline-fallback page (Capacitor requires a
//                           non-empty webDir even when server.url is set)
//
//   APP_SLUG=files node .github/scripts/gen-capacitor-config.mjs build/files
//
// env:
//   APP_SLUG        (required)  the app's registry slug, e.g. "files"
//   SITE_BASE       base url the app is deployed at (default https://zugriff.dev)
//   APP_URL         full app url (default `${SITE_BASE}/apps/${slug}/`)
//   APP_ID_PREFIX   reverse-dns prefix for the appId
//                   (default dev.zugriff — appId is `${APP_ID_PREFIX}.${segment}`,
//                    e.g. dev.zugriff.files, matching /.well-known/assetlinks.json
//                    and the TWA package ids)

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registry } from './../../.shared/js/registry.js';

const slug = process.env.APP_SLUG;
if (!slug) { console.error('gen-capacitor-config: APP_SLUG is required'); process.exit(1); }

const app = registry.get(slug);
if (!app || app.type !== 'app') { console.error(`gen-capacitor-config: no app "${slug}" in the registry`); process.exit(1); }

const base     = (process.env.SITE_BASE || 'https://zugriff.dev').replace(/\/+$/, '');
const appUrl   = (process.env.APP_URL || `${base}/apps/${slug}/`).replace(/\/*$/, '/');
const idPrefix = process.env.APP_ID_PREFIX || 'dev.zugriff';
const outDir   = process.argv[2] || '.';

// a valid Android package segment: only [a-zA-Z0-9_], never leading with a digit
// (same rule the TWA script uses, so the appId lines up with dev.zugriff.<slug>)
const segment = slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a$1');

const config = {
  appId   : `${idPrefix}.${segment}`,
  appName : app.short_name || app.name || slug,
  webDir  : 'www',
  server  : {
    url            : appUrl,           // wrap the live deployment, exactly like the TWA
    androidScheme  : 'https',
    cleartext      : false,
  },
  plugins : {},
};

// offline fallback: shown only if the device is offline on first launch (with a
// live server.url the webview otherwise loads the real site straight away).
const fallback = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${config.appName}</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font:16px system-ui;background:#282a36;color:#f8f8f2">
  <p style="opacity:.7">Offline — reconnect to open ${config.appName}.</p>
</body>`;

await mkdir(join(outDir, 'www'), { recursive: true });
await writeFile(join(outDir, 'capacitor.config.json'), JSON.stringify(config, null, 2) + '\n');
await writeFile(join(outDir, 'www', 'index.html'), fallback);

console.log(`gen-capacitor-config: wrote ${join(outDir, 'capacitor.config.json')}`);
console.log(`  appId ${config.appId}  ·  url ${config.server.url}`);
