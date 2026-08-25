// .github/scripts/gen-twa-manifest.mjs
//
// writes a Bubblewrap `twa-manifest.json` for one app, deterministically and
// without any of Bubblewrap's interactive `init` prompts — which is what makes
// the Android build runnable in CI (see .github/workflows/build-android.yml).
//
// it leans on @bubblewrap/core's own TwaManifest.fromWebManifest(), so the file
// is always shaped for the installed Bubblewrap version: it fetches the app's
// live Web App Manifest and fills host / startUrl / name / icons from it. we
// then override only what CI must control — the Android packageId and the
// signing key — and save.
//
//   APP_SLUG=podcasts node .github/scripts/gen-twa-manifest.mjs build/podcasts/twa-manifest.json
//
// env:
//   APP_SLUG        (required)  the app's registry slug, e.g. "podcasts"
//   SITE_BASE       base url the app is deployed at (default https://zugriff.dev)
//   MANIFEST_URL    full manifest url (default `${SITE_BASE}/apps/${slug}/manifest.json`)
//   KEYSTORE_PATH   path to the signing keystore (default ./android.keystore)
//   KEY_ALIAS       key alias inside the keystore (default android)
//   APP_ID_PREFIX   reverse-dns prefix for the packageId
//                   (default dev.pulgasari.zugriff)

import { TwaManifest } from '@bubblewrap/core';

const slug = process.env.APP_SLUG;
if (!slug) { console.error('gen-twa-manifest: APP_SLUG is required'); process.exit(1); }

const base        = (process.env.SITE_BASE || 'https://zugriff.dev').replace(/\/+$/, '');
const manifestUrl = process.env.MANIFEST_URL || `${base}/apps/${slug}/manifest.json`;
const out         = process.argv[2] || 'twa-manifest.json';
const keystore    = process.env.KEYSTORE_PATH || 'android.keystore';
const alias       = process.env.KEY_ALIAS || 'android';
const idPrefix    = process.env.APP_ID_PREFIX || 'dev.pulgasari.zugriff';

// a valid Android package segment: only [a-zA-Z0-9_], never leading with a digit
const segment = slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a$1');

const twa = await TwaManifest.fromWebManifest(manifestUrl);
twa.packageId  = `${idPrefix}.${segment}`;
twa.signingKey = { path: keystore, alias };

await twa.saveToFile(out);
console.log(`gen-twa-manifest: wrote ${out}`);
console.log(`  packageId ${twa.packageId}  ·  host ${twa.host}  ·  startUrl ${twa.startUrl}`);
