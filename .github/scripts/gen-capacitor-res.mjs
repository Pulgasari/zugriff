// .github/scripts/gen-capacitor-res.mjs
//
// replaces the capacitor template's android resources with the app's own, after
// `cap add android` has written the template (see build-capacitor.yml):
//
//   launcher icons   mipmap-*/ic_launcher{,_round,_foreground}.png from apps/<slug>/app.svg,
//                    plus values/ic_launcher_background.xml -> the app color
//   system bars      status + navigation bar in the app color instead of the
//                    DayNight default (black in dark mode). a remote server.url page
//                    cannot style them itself: <meta theme-color> means nothing to a
//                    plain android webview
//   launch screen    the app color instead of @drawable/splash (the capacitor logo)
//
// the color is the registry's `color` (defaults.color unless the entry overrides it),
// the same value the manifest uses for theme_color / background_color.
//
//   APP_SLUG=files node .github/scripts/gen-capacitor-res.mjs build/files
//
// needs sharp, which the repo root's package.json already lists.
//
// NOTE: capacitor 8 targets sdk 36, so android 15+ runs edge-to-edge and ignores
// statusBarColor / navigationBarColor. on a webview >= 140 the page paints behind
// the bars itself (theme.css, safe-area insets); the colors here are the fallback
// for older android versions and for older webviews, which capacitor insets
// natively over the window background.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { registry } from './../../.shared/js/data/apps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const slug = process.env.APP_SLUG;
if (!slug) { console.error('gen-capacitor-res: APP_SLUG is required'); process.exit(1); }

const app = registry.get(slug);
if (!app || app.type !== 'app') { console.error(`gen-capacitor-res: no app "${slug}" in the registry`); process.exit(1); }

const color  = app.color;
const resDir = join(process.argv[2] || '.', 'android', 'app', 'src', 'main', 'res');

// :::::: ICONS

// launcher size in px per density bucket. legacy icons are 48dp, the adaptive
// foreground layer is 108dp of which only the inner 72dp is guaranteed visible
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LEGACY_DP = 48;
const LAYER_DP  = 108;

// share of the canvas the glyph's longer side spans. measured on the glyph itself,
// not on the svg box: some sources pad the glyph inside a background (files),
// others fill the box edge to edge (code, prompts). 48 of 108dp keeps an adaptive
// foreground inside every launcher mask, the legacy share matches its visual weight
const FG_SCALE     = 48 / 108;
const LEGACY_SCALE = 0.62;

// the source svg carries its own background as a full-size first <rect> (most do,
// code and prompts don't). adaptive icons bring the background as a separate
// layer, so the rect goes and only the glyph is left for the foreground
const FULL_RECT = /<rect\b(?=[^>]*\bwidth="(?:512|100%)")(?=[^>]*\bheight="(?:512|100%)")[^>]*\/>/;

const source = await readFile(join(ROOT, 'apps', slug, 'app.svg'), 'utf8');

// rendered once, large, and cropped to its bounding box
const glyph = await sharp(Buffer.from(source.replace(FULL_RECT, '')), { density: 1024 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .trim()
  .png()
  .toBuffer();

// glyph centred on a transparent canvas, its longer side `scale` of the edge
async function centred (canvas, scale) {
  const box = Math.round(canvas * scale);
  const fit = await sharp(glyph)
    .resize(box, box, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fit.data, left: Math.round((canvas - fit.info.width) / 2), top: Math.round((canvas - fit.info.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// glyph on a filled shape in the app color: a rounded square or a circle
async function legacy (canvas, round) {
  const shape = round
    ? `<circle cx="${canvas / 2}" cy="${canvas / 2}" r="${canvas / 2}" fill="${color}"/>`
    : `<rect width="${canvas}" height="${canvas}" rx="${canvas * 0.1875}" fill="${color}"/>`;

  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}">${shape}</svg>`);

  return sharp(base)
    .composite([{ input: await centred(canvas, LEGACY_SCALE) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

for (const [bucket, factor] of Object.entries(DENSITIES)) {
  const dir    = join(resDir, `mipmap-${bucket}`);
  const icon   = Math.round(LEGACY_DP * factor);
  const layer  = Math.round(LAYER_DP  * factor);

  await writeFile(join(dir, 'ic_launcher.png'),            await legacy(icon, false));
  await writeFile(join(dir, 'ic_launcher_round.png'),      await legacy(icon, true));
  await writeFile(join(dir, 'ic_launcher_foreground.png'), await centred(layer, FG_SCALE));
}

await writeFile(join(resDir, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${color}</color>
</resources>
`);

// :::::: SYSTEM BARS + LAUNCH SCREEN

// bar icons have to contrast with the bar: light icons on a dark color and back
const luminance = (hex) => {
  const h   = hex.replace('#', '');
  const rgb = (h.length === 3 ? [...h].map(c => c + c) : h.slice(0, 6).match(/../g)).map(c => parseInt(c, 16) / 255);
  const lin = rgb.map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const light = luminance(color) > 0.5;

const MARK = 'zugriff:bars';
const bars = [
  `<!-- ${MARK} -->`,
  `<item name="android:statusBarColor">${color}</item>`,
  `<item name="android:navigationBarColor">${color}</item>`,
  `<item name="android:windowLightStatusBar">${light}</item>`,
  `<item name="android:windowLightNavigationBar" tools:targetApi="27">${light}</item>`,
  `<item name="android:windowBackground">@color/ic_launcher_background</item>`,
];

const stylesPath = join(resDir, 'values', 'styles.xml');
let styles = await readFile(stylesPath, 'utf8');

// the webview activity switches to AppTheme.NoActionBar once it runs, the launch
// theme covers the moments before. both get the bars, so nothing flashes black
function patch (name, extra = []) {
  const open = new RegExp(`(<style name="${name.replace('.', '\\.')}"[^>]*>)([\\s\\S]*?)(</style>)`);
  if (!open.test(styles)) throw new Error(`gen-capacitor-res: style ${name} not found, the capacitor template changed`);

  styles = styles.replace(open, (_, head, body, tail) => {
    if (body.includes(MARK)) return head + body + tail; // already patched
    const items = [...bars, ...extra].map(line => `        ${line}`).join('\n');
    return `${head}${body.replace(/\s*$/, '')}\n${items}\n    ${tail}`;
  });
}

patch('AppTheme.NoActionBar');
patch('AppTheme.NoActionBarLaunch', [`<item name="windowSplashScreenBackground">${color}</item>`]);

// the launch theme paints @drawable/splash, i.e. the capacitor logo
styles = styles.replace('<item name="android:background">@drawable/splash</item>', '<item name="android:background">@color/ic_launcher_background</item>');

// tools:targetApi needs its namespace on the root
if (!styles.includes('xmlns:tools')) styles = styles.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">');

await writeFile(stylesPath, styles);

console.log(`gen-capacitor-res: ${slug} -> icons, bars and launch screen in ${color}${light ? ' (dark bar icons)' : ''}`);
