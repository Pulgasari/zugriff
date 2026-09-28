// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the matrix build-android-capacitor.yml
// packages, one { app, dev, file } per build of the apps built as BUILDER
// ('capacitor' by default, or 'capacitor-live'), see android.js. with `devtools`
// set in bundler.config.js a bundled app is built a second time with dev: '-dev'.
// file is the apk/aab name, one stamp for the whole run.

import fs from 'node:fs';
import { devtools } from './../../bundler.config.js';
import { fileOf, slugsFor, stampOf } from './android.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only    = process.env.APP_FILTER?.trim();
const builder = process.env.BUILDER || 'capacitor';
const stamp   = stampOf();

const builds = slugsFor(builder, only).flatMap(app => [false, ...(builder === 'capacitor' && devtools ? [true] : [])]
  .map(dev => ({ app, dev: dev ? '-dev' : '', file: fileOf(app, builder, stamp, { dev }) })));

const output = JSON.stringify(builds);
console.log(only ? `found ${builder} builds (filtered to "${only}"): ${output}`
                 : `found ${builder} builds: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
