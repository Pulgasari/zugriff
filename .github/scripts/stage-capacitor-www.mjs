// .github/scripts/stage-capacitor-www.mjs
//
// stages the webDir of a capacitor build (build.android: 'capacitor'): instead of
// wrapping the live url, the app's own files ship inside the apk and capacitor
// serves them from https://localhost/.
//
//   APP_SLUG=files PKG_SOURCE=build/_pkg node .github/scripts/stage-capacitor-www.mjs build/files
//
// the work is @aufbau/bundler's, with bundler.config.js from the repo root. the
// bundler comes from the aufbau checkout among the packages (cloned when
// missing), so it is the same aufbau the app is bundled with. its summary (what
// is local, what still goes over the network) goes to stdout and, on ci, to the
// step summary.
//
// env:
//   APP_SLUG    (required)  the app's registry slug
//   PKG_SOURCE  where the package repos are, or get cloned to (default build/_pkg)

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registry } from './../../.shared/js/data/apps.js';
import config from './../../bundler.config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const slug = process.env.APP_SLUG;
if (!slug) { console.error('stage-capacitor-www: APP_SLUG is required'); process.exit(1); }
if (!registry.get(slug)) { console.error(`stage-capacitor-www: no app "${slug}" in the registry`); process.exit(1); }

const outDir   = process.argv[2] || join('build', slug);
const packages = process.env.PKG_SOURCE || join('build', '_pkg');

const aufbau = join(ROOT, packages, 'aufbau');
if (!existsSync(aufbau)) execFileSync('git', ['clone', '--quiet', '--depth', '1', 'https://github.com/Pulgasari/aufbau.git', aufbau], { stdio: 'inherit' });

const { bundle } = await import(pathToFileURL(join(aufbau, 'bundler', 'index.js')));
const { summary } = await bundle({ ...config({ out: resolve(outDir, 'www'), packages, slug }), root: ROOT });

const text = `### www: ${slug}\n\n${summary}\n`;
console.log('\n' + text);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
