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
//   DEVTOOLS    1 for the -dev build, with @aufbau/devtools and opened on ?dev
//   PKG_SOURCE  where the package repos are, or get cloned to (default build/_pkg)
//   OTA_VERSION the version of this bundle (default: this minute, yyyymmddhhmm)
//   OTA_MANIFEST the url of the newest bundle's ota.json, for the build `capacitor`
//
// next to the app it writes www/ota.json, { slug, version, manifest }: the version
// the bundle tells about itself, and where .shared/js/modules/ota.js looks for a
// newer one

// :::::: IMPORT

// ::: NODE.JS
import { execFileSync }                    from 'node:child_process';
import { existsSync }                      from 'node:fs';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve }          from 'node:path';
import { fileURLToPath, pathToFileURL }    from 'node:url';

// ::: ZUGRIFF
import { registry } from './../../.shared/js/data/apps.js';
import config       from './../../bundler.config.js';
import { stampOf }  from './android.js';

// ::::::

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const slug = process.env.APP_SLUG;
if (!slug) { console.error('stage-capacitor-www: APP_SLUG is required'); process.exit(1); }
if (!registry.get(slug)) { console.error(`stage-capacitor-www: no app "${slug}" in the registry`); process.exit(1); }

/*
const paths = {};
paths.out    = process.argv[2]        || join('build', slug);
paths.pkg    = process.env.PKG_SOURCE || join('build', '_pkg');
paths.aufbau = join(ROOT, paths.pkg, 'aufbau');
*/

const outDir   = process.argv[2] || join('build', slug);
const packages = process.env.PKG_SOURCE || join('build', '_pkg');
const aufbau   = join(ROOT, packages, 'aufbau');
if (!existsSync(aufbau)) execFileSync('git', ['clone', '--quiet', '--depth', '1', 'https://github.com/Pulgasari/aufbau.git', aufbau], { stdio: 'inherit' });

// the bundler's own dependencies (esbuild for the vendor step)
const bundler = join(aufbau, 'bundler');
if (!existsSync(join(bundler, 'node_modules'))) execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], { cwd: bundler, stdio: 'inherit' });

const { bundle } = await import(pathToFileURL(join(bundler, 'index.js')));
const dev = process.env.DEVTOOLS === '1';
const { summary } = await bundle({ ...config({ dev, out: resolve(outDir, 'www'), packages, slug }), root: ROOT });

// a bundle is one app: its index.html names it, so the shell does not need the app in
// the path. capacitor at https://localhost/ and <slug>.zugriff.dev both open it at /
const index = resolve(outDir, 'www', 'index.html');
await writeFile(index, (await readFile(index, 'utf8')).replace(/<html\b/, `<html data-app="${slug}"`));

const ota = { slug, version: process.env.OTA_VERSION || stampOf(), ...(process.env.OTA_MANIFEST && { manifest: process.env.OTA_MANIFEST }) };
await writeFile(resolve(outDir, 'www', 'ota.json'), JSON.stringify(ota, null, 2) + '\n');

// the service worker's caches carry the bundle's version, a new bundle starts on fresh ones
const service = resolve(outDir, 'www', '.shared', 'js', 'service.js');
if (existsSync(service)) await writeFile(service, (await readFile(service, 'utf8')).replace(/^const VERSION = '[^']*';$/m, `const VERSION = '${ota.version}';`));

const text = `### www: ${slug}${dev ? '-dev' : ''}\n\n${summary}\n`;
console.log('\n' + text);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
