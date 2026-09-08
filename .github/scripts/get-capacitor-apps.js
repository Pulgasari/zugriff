// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the json array of app slugs whose
// registry entry sets build.android === 'capacitor' — the matrix the
// build-capacitor workflow packages. an app targets exactly one android builder.

import fs from 'node:fs';
import { registry } from './../../.shared/js/data/apps.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only = process.env.APP_FILTER?.trim();

const apps = registry
  .getAll('app')
  .filter((app) => app.build?.android === 'capacitor')
  .filter((app) => !only || app.slug === only)
  .map((app) => app.slug);

const output = JSON.stringify(apps);
console.log(only ? `found capacitor apps (filtered to "${only}"): ${output}`
                 : `found capacitor apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
