// scripts/get-autopack-apps.js

import fs from 'node:fs';
import { registry } from './../shared/js/registry.js';

// Filter apps where autopack flag is set to true
const autopackApps = registry
  .getAll('app')
  .filter((app) => app.autopack === true)
  .map((app) => app.slug);

const output = JSON.stringify(autopackApps);
console.log(`Found autopack apps: ${output}`);

// Pass output to GitHub Actions environment
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `apps=${output}\n`);
}
