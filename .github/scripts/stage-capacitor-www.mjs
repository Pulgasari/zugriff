// .github/scripts/stage-capacitor-www.mjs
//
// stages the webDir of a capacitor build (build.android: 'capacitor'): instead of
// wrapping the live url, the app's own files ship inside the apk and capacitor
// serves them from https://localhost/.
//
//   APP_SLUG=files PKG_SOURCE=build/_pkg node .github/scripts/stage-capacitor-www.mjs build/files
//
// <projectDir>/www/ becomes a copy of the site as the app sees it:
//
//   index.html        the root shell, with a start script that moves / to /<slug>/
//   .shared/          the shared js and css
//   <slug>/           apps/<slug>/, where vercel's rewrite puts it on the live site
//   _pkg/<repo>/      the first-party packages code.pulgasari.dev serves (aufbau,
//                     domina, bunker …), every https://code.pulgasari.dev in the
//                     staged files points there
//
// capacitor answers a path without a file extension with the root index.html, so
// /<slug>/ loads the shell and the shell loads /<slug>/app.js, as on the live site.
//
// the repos come from PKG_SOURCE/<repo>. a missing one is cloned from github
// (depth 1). what still points off the device — esm.sh, jsdelivr, unpkg, apis —
// is listed at the end, and in the step summary on ci: that is what a real
// bundler still has to take over.
//
// env:
//   APP_SLUG    (required)  the app's registry slug
//   PKG_SOURCE  where the package repos are, or get cloned to (default build/_pkg)
//   PKG_ORIGIN  the origin the importmap points to (default https://code.pulgasari.dev)
//   GIT_OWNER   the github owner of the package repos (default Pulgasari)

import { execFileSync } from 'node:child_process';
import { appendFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from './../../.shared/js/data/apps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const slug = process.env.APP_SLUG;
if (!slug) { console.error('stage-capacitor-www: APP_SLUG is required'); process.exit(1); }
if (!registry.get(slug)) { console.error(`stage-capacitor-www: no app "${slug}" in the registry`); process.exit(1); }

const outDir    = process.argv[2] || join('build', slug);
const www       = join(outDir, 'www');
const pkgSource = process.env.PKG_SOURCE || join('build', '_pkg');
const pkgOrigin = (process.env.PKG_ORIGIN || 'https://code.pulgasari.dev').replace(/\/+$/, '');
const gitOwner  = process.env.GIT_OWNER || 'Pulgasari';

const PKG_PATH = '/_pkg';
const TEXT     = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg']);

// never shipped: history, tooling, demo sites, tests and parked code
const SKIP = new Set(['.git', '.github', '.trash', '_', 'node_modules', 'test', 'tests', 'www']);
const skip = source => SKIP.has(source.split('/').pop());

// :::::: HELPERS

async function walk (directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}

const copy = (from, to) => cp(from, to, { dereference: true, recursive: true, filter: source => !skip(source) });

// :::::: SITE

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const file of ['index.html', 'icon.svg', 'logo.svg']) await copy(join(ROOT, file), join(www, file));
await copy(join(ROOT, '.shared'), join(www, '.shared'));
await copy(join(ROOT, 'apps', slug), join(www, slug));

// :::::: PACKAGES

// the repos the staged files reach on the package origin: <origin>/<repo>/…
// boot.js spells the importmap as `${pkg}/<repo>/…`, the rest as full urls
const repos = new Set;
for (const file of await walk(www)) {
  if (!TEXT.has(extname(file))) continue;
  const text = await readFile(file, 'utf8');
  for (const [, repo] of text.matchAll(/\$\{pkg\}\/([\w.-]+)\//g)) repos.add(repo);
  for (const [, repo] of text.matchAll(new RegExp(`${pkgOrigin.replace(/[.]/g, '\\.')}/([\\w.-]+)/`, 'g'))) repos.add(repo);
}

const missingRepos = [];
for (const repo of [...repos].sort()) {
  const source = join(pkgSource, repo);
  if (!existsSync(source)) {
    try {
      execFileSync('git', ['clone', '--quiet', '--depth', '1', `https://github.com/${gitOwner}/${repo}.git`, source], { stdio: 'inherit' });
    } catch {
      missingRepos.push(repo);
      continue;
    }
  }
  await copy(source, join(www, '_pkg', repo));
}

// :::::: REWRITE

// the package origin becomes the staged copy. boot.js keeps its origin in a
// constant, so that one string covers the whole importmap
const remote = new Map;   // host -> files that still reach it
for (const file of await walk(www)) {
  if (!TEXT.has(extname(file))) continue;
  const text = await readFile(file, 'utf8');
  const next = text.replaceAll(pkgOrigin, PKG_PATH);
  if (next !== text) await writeFile(file, next);

  // the app's own code only: the packages carry docs and examples full of urls
  const path = relative(www, file);
  if (path.startsWith('_pkg/')) continue;
  for (const [, host] of next.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})\//g)) {
    if (!remote.has(host)) remote.set(host, new Set);
    remote.get(host).add(path);
  }
}

// :::::: START

// capacitor opens https://localhost/, the shell reads its route from the path
const start = `<script>if (location.pathname === '/') history.replaceState(null, '', '/${slug}/' + location.search + location.hash);</script>`;
const index = join(www, 'index.html');
await writeFile(index, (await readFile(index, 'utf8')).replace(/<head>/, `<head>\n  ${start}`));

// :::::: REPORT

const bytes = (await Promise.all((await walk(www)).map(file => stat(file)))).reduce((sum, info) => sum + info.size, 0);
const lines = [
  `### www: ${slug}`,
  '',
  `staged ${(bytes / 1024 / 1024).toFixed(1)} mb into \`${www}\`, packages: ${[...repos].sort().filter(repo => !missingRepos.includes(repo)).join(', ') || 'none'}`,
  '',
  ...(missingRepos.length ? [`**not staged** (no checkout, not clonable): ${missingRepos.join(', ')}`, ''] : []),
  'still reached over the network:',
  '',
  ...[...remote].sort(([a], [b]) => a.localeCompare(b)).map(([host, files]) => `- \`${host}\` — ${[...files].sort().slice(0, 4).join(', ')}${files.size > 4 ? ` … (${files.size} files)` : ''}`),
];

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
