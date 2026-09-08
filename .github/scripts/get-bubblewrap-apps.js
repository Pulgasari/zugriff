// .github/scripts/get-bubblewrap-apps.js
//
// emits the json array of app slugs whose registry entry sets
// build.android === 'bubblewrap' — the matrix the build-android (twa/bubblewrap)
// workflow packages. sibling of get-capacitor-apps.js; an app targets exactly one
// android builder.

import fs from 'node:fs';
import { registry } from './../../.shared/js/data/apps.js';

// optional single-app filter, set by the workflow's `app` dispatch input
const only = process.env.APP_FILTER?.trim();

const apps = registry
  .getAll('app')
  .filter((app) => app.build?.android === 'bubblewrap')
  .filter((app) => !only || app.slug === only)
  .map((app) => app.slug);

const output = JSON.stringify(apps);
console.log(only ? `found bubblewrap apps (filtered to "${only}"): ${output}`
                 : `found bubblewrap apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
