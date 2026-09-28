// .github/scripts/get-bubblewrap-apps.js
//
// emits the matrix build-android-bubblewrap.yml (twa) packages, one { app, file }
// per app built as 'bubblewrap', see android.js. file is the apk/aab name, one
// stamp for the whole run. sibling of get-capacitor-apps.js.

import fs from 'node:fs';
import { fileOf, slugsFor, stampOf } from './android.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only  = process.env.APP_FILTER?.trim();
const stamp = stampOf();

const output = JSON.stringify(slugsFor('bubblewrap', only).map(app => ({ app, file: fileOf(app, 'bubblewrap', stamp) })));
console.log(only ? `found bubblewrap apps (filtered to "${only}"): ${output}`
                 : `found bubblewrap apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
