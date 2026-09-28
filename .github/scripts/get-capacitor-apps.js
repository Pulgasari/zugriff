// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the matrix build-android-capacitor.yml
// packages, one { app, dev } per build of the apps built as BUILDER ('capacitor'
// by default, or 'capacitor-live'), see android.js. with `devtools` set in
// bundler.config.js a bundled app is built a second time with dev: '-dev'.

import fs from 'node:fs';
import { devtools } from './../../bundler.config.js';
import { slugsFor } from './android.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only    = process.env.APP_FILTER?.trim();
const builder = process.env.BUILDER || 'capacitor';

const builds = slugsFor(builder, only).flatMap(app => builder === 'capacitor' && devtools ? [{ app, dev: '' }, { app, dev: '-dev' }] : [{ app, dev: '' }]);

const output = JSON.stringify(builds);
console.log(only ? `found ${builder} builds (filtered to "${only}"): ${output}`
                 : `found ${builder} builds: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
