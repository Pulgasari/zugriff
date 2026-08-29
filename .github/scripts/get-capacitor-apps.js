// .github/scripts/get-capacitor-apps.js
//
// sibling of get-autopack-apps.js, but for the Capacitor pipeline: emits the JSON
// array of app slugs marked `capacitor: true` in .shared/js/registry.js — the
// matrix the build-capacitor workflow packages. kept separate from `autopack`
// (the Bubblewrap/TWA flag) so an app can be wrapped as a TWA, as a Capacitor
// app, both, or neither, independently.

import fs from 'node:fs';
import { registry } from './../../.shared/js/registry.js';

const capacitorApps = registry
  .getAll('app')
  .filter((app) => app.capacitor === true)
  .map((app) => app.slug);

const output = JSON.stringify(capacitorApps);
console.log(`Found capacitor apps: ${output}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
