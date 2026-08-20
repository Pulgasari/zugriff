// scripts/gen-app-assets.mjs
//
// one source of truth → every derived icon + manifest. for each `type: 'app'`
// entry in shared/js/registry.js this reads apps/<slug>/app.svg and writes:
//
//   apps/<slug>/assets/icon.svg      a copy of app.svg (self-contained assets/)
//   apps/<slug>/assets/icon-192.png  rasterised install icon
//   apps/<slug>/assets/icon-512.png  rasterised install icon
//   apps/<slug>/manifest.json        built entirely from the registry entry
//
// nothing here is hand-authored — edit the registry entry or app.svg and rerun.
//
//   node scripts/gen-app-assets.mjs            # write everything
//   node scripts/gen-app-assets.mjs notes      # just one (or more) slugs
//   node scripts/gen-app-assets.mjs --check    # verify, exit 1 on drift/missing
//
// the --check mode is what CI uses to tell you "you changed app.svg or the
// registry but didn't regenerate". the GitHub Action then regenerates and
// commits the result, so you normally never run this by hand.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPS_DIR = join(ROOT, 'apps');
const SIZES    = [192, 512];

const check = process.argv.includes('--check');
const only  = process.argv.slice(2).filter(a => !a.startsWith('--'));

// ── the manifest, derived wholly from a registry entry ───────────────────────

function buildManifest (app) {
  const m = app.manifest ?? {};
  return {
    id               : app.id ?? app.slug,
    name             : app.name,
    short_name       : app.short_name ?? app.name,
    description      : m.description ?? app.description ?? '',
    lang             : app.lang ?? 'en',
    dir              : app.dir ?? 'ltr',
    scope            : './',
    start_url        : './',
    display          : app.display ?? 'standalone',
    orientation      : m.orientation ?? app.orientation ?? 'any',
    categories       : m.categories ?? app.categories ?? [],
    background_color : m.background_color ?? app.color ?? '#000000',
    theme_color      : m.theme_color ?? app.color ?? '#000000',
    icons: [
      { src: './assets/icon.svg',     sizes: 'any',     type: 'image/svg+xml', purpose: 'any' },
      { src: './assets/icon-192.png', sizes: '192x192', type: 'image/png',     purpose: 'any' },
      { src: './assets/icon-512.png', sizes: '512x512', type: 'image/png',     purpose: 'any' },
    ],
  };
}

const manifestJson = app => JSON.stringify(buildManifest(app), null, 2) + '\n';

const exists = p => access(p).then(() => true, () => false);

// ── generate / verify one app ────────────────────────────────────────────────

async function processApp (app) {
  const dir     = join(APPS_DIR, app.slug);
  const svgPath = join(dir, 'app.svg');
  const assets  = join(dir, 'assets');
  const rel     = p => relative(ROOT, p);
  const drift   = [];

  if (!await exists(svgPath)) {
    return { slug: app.slug, missingSvg: true, drift: [`${rel(svgPath)} is missing`] };
  }
  const svg = await readFile(svgPath);

  // the three icon files: a copy of the source svg + two rasterised sizes
  const outputs = [{ path: join(assets, 'icon.svg'), buf: svg }];
  for (const size of SIZES) {
    const png = await sharp(svg, { density: 512 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    outputs.push({ path: join(assets, `icon-${size}.png`), buf: png });
  }

  const manifestPath = join(dir, 'manifest.json');
  const manifestText = manifestJson(app);

  if (check) {
    // drift = the svg copy is stale (source changed), a png is missing, or the
    // manifest no longer matches the registry. png bytes aren't compared —
    // they vary by sharp version — the stale svg copy is the reliable signal.
    if (!await exists(outputs[0].path) || !svg.equals(await readFile(outputs[0].path)))
      drift.push(`${rel(outputs[0].path)} out of date (app.svg changed?)`);
    for (const size of SIZES)
      if (!await exists(join(assets, `icon-${size}.png`))) drift.push(`${rel(join(assets, `icon-${size}.png`))} missing`);
    const current = await exists(manifestPath) ? await readFile(manifestPath, 'utf8') : '';
    if (current !== manifestText) drift.push(`${rel(manifestPath)} out of date`);
    return { slug: app.slug, drift };
  }

  await mkdir(assets, { recursive: true });
  for (const { path, buf } of outputs) await writeFile(path, buf);
  await writeFile(manifestPath, manifestText);
  return { slug: app.slug, wrote: outputs.length + 1 };
}

// ── main ─────────────────────────────────────────────────────────────────────

const { registry } = await import(new URL('../shared/js/registry.js', import.meta.url));
let apps = registry.getAll('app');
if (only.length) apps = apps.filter(a => only.includes(a.slug));
if (!apps.length) { console.error(`[gen-app-assets] no apps matched ${only.join(', ')}`); process.exit(1); }

const results = [];
for (const app of apps) results.push(await processApp(app));

const problems = results.filter(r => r.missingSvg || r.drift?.length);

if (check) {
  for (const r of results) (r.drift ?? []).forEach(d => console.error(`  ✗ ${d}`));
  if (problems.length) {
    console.error(`\n[gen-app-assets] ${problems.length} app(s) out of date — run: node scripts/gen-app-assets.mjs`);
    process.exit(1);
  }
  console.log(`[gen-app-assets] ${results.length} app(s) up to date ✓`);
} else {
  for (const r of results) {
    if (r.missingSvg) console.error(`  ✗ ${r.slug}: app.svg missing — skipped`);
    else console.log(`  ✓ ${r.slug}: wrote assets + manifest.json`);
  }
  // a missing app.svg is a real error even in write mode
  if (results.some(r => r.missingSvg)) process.exit(1);
}
