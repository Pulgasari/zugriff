// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the matrix build-android-capacitor.yml
// packages, one { app, dev, file } per build of the apps built as BUILDER
// ('capacitor' by default, 'capacitor-bundle' or 'capacitor-live'), see android.js.
// with `devtools` set in bundler.config.js a capacitor app is built a second time
// with dev: '-dev'.
// file is the apk/aab name, stamp the run's minute: the version of the bundle
// inside, the same for every build of the run.

import fs from 'node:fs';
import { devtools } from './../../bundler.config.js';
import { fileOf, slugsFor, stampOf, variantsOf } from './android.js';
import { registry } from './../../.shared/js/data/apps.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only    = process.env.APP_FILTER?.trim();
const builder = process.env.BUILDER || 'capacitor';
const stamp   = stampOf();

const builds = slugsFor(builder, only).flatMap(app => [false, ...(builder === 'capacitor' && devtools ? [true] : [])]
  .map(dev => ({ app, dev: dev ? '-dev' : '', file: fileOf(app, builder, stamp, { dev }), stamp })));

// an app asked for by name that is not built as BUILDER fails the run, it would
// skip the build and pass green
if (only && !builds.length) {
  const app = registry.getAll('app').find(app => app.slug === only);
  console.error(app ? `"${only}" is not built as ${builder}, its build.android: ${JSON.stringify(variantsOf(app))}`
                    : `no app "${only}" in the registry`);
  process.exit(1);
}

const output = JSON.stringify(builds);
console.log(only ? `found ${builder} builds (filtered to "${only}"): ${output}`
                 : `found ${builder} builds: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
