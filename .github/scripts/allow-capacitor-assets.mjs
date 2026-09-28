// .github/scripts/allow-capacitor-assets.mjs
//
// lets hidden files and folders into the apk. capacitor's android template
// packages the web assets with aapt's ignoreAssetsPattern, which drops every
// name starting with a dot (`.*`). zugriff's shell lives in .shared/, so a
// bundled build would ship without boot.js and show a white screen. this takes
// `.*` out of the pattern, the rest (.git, .svn, .ds_store …) stays excluded.
//
//   node .github/scripts/allow-capacitor-assets.mjs build/podcasts
//
// runs after `cap add android`, idempotent.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const file   = join(process.argv[2] || '.', 'android', 'app', 'build.gradle');
const gradle = await readFile(file, 'utf8');

const pattern = gradle.match(/ignoreAssetsPattern\s*=?\s*'([^']*)'/);
if (!pattern) { console.error(`allow-capacitor-assets: no ignoreAssetsPattern in ${file}`); process.exit(1); }

const entries = pattern[1].split(':').filter(entry => entry !== '.*');
await writeFile(file, gradle.replace(pattern[1], entries.join(':')));

console.log(`allow-capacitor-assets: ${pattern[1]} -> ${entries.join(':')}`);
