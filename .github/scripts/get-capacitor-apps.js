// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the json array of app slugs built as
// BUILDER ('capacitor' by default, or 'capacitor-live'), see android.js — the
// matrix build-android-capacitor.yml packages.

import fs from 'node:fs';
import { slugsFor } from './android.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only    = process.env.APP_FILTER?.trim();
const builder = process.env.BUILDER || 'capacitor';

const output = JSON.stringify(slugsFor(builder, only));
console.log(only ? `found ${builder} apps (filtered to "${only}"): ${output}`
                 : `found ${builder} apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
