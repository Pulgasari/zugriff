// .github/scripts/get-capacitor-apps.js
//
// sibling of get-bubblewrap-apps.js: emits the json array of app slugs whose
// registry entry sets build.android === 'capacitor' — the matrix the
// build-capacitor workflow packages. an app targets exactly one android builder.

import fs from 'node:fs';
import { registry } from './../../.shared/js/data/apps.js';

const apps = registry
  .getAll('app')
  .filter((app) => app.build?.android === 'capacitor')
  .map((app) => app.slug);

const output = JSON.stringify(apps);
console.log(`found capacitor apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
