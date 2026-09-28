// .github/scripts/get-bubblewrap-apps.js
//
// emits the json array of app slugs built as 'bubblewrap', see android.js — the
// matrix build-android-bubblewrap.yml (twa) packages. sibling of
// get-capacitor-apps.js.

import fs from 'node:fs';
import { slugsFor } from './android.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only = process.env.APP_FILTER?.trim();

const output = JSON.stringify(slugsFor('bubblewrap', only));
console.log(only ? `found bubblewrap apps (filtered to "${only}"): ${output}`
                 : `found bubblewrap apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
