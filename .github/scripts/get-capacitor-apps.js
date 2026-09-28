// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the json array of app slugs whose
// registry entry sets build.android === BUILDER ('capacitor' by default, or
// 'capacitor-live') — the matrix build-android-capacitor.yml packages. an app
// targets exactly one android builder. a single app asked for by APP_FILTER is
// built with either capacitor builder, so an app can try the other variant.

import fs from 'node:fs';
import { registry } from './../../.shared/js/data/apps.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only    = process.env.APP_FILTER?.trim();
const builder = process.env.BUILDER || 'capacitor';

const apps = registry
  .getAll('app')
  .filter((app) => only ? app.slug === only && app.build?.android?.startsWith('capacitor') : app.build?.android === builder)
  .map((app) => app.slug);

const output = JSON.stringify(apps);
console.log(only ? `found ${builder} apps (filtered to "${only}"): ${output}`
                 : `found ${builder} apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
