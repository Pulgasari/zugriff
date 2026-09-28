// .github/scripts/android.js
// the android build variants of the registry entries. build.android is one
// variant or a list of them:
//
//   build: { android: 'capacitor' }
//   build: { android: ['capacitor', 'capacitor-live'] }
//
// names, ids and files carry the variant, all but capacitor's bundled build,
// which is the app itself. dev is the -dev build with devtools (capacitor only),
// so the variants of an app install side by side:
//
//   variant          name              id                        file
//   capacitor        Podcasts          dev.zugriff.podcasts      podcasts-202612011212.apk
//   capacitor + dev  Podcasts (dev)    dev.zugriff.podcasts.dev  podcasts-202612011212-dev.apk
//   capacitor-live   Podcasts (live)   dev.zugriff.podcasts.live podcasts-202612011212-live.apk
//   bubblewrap       Podcasts (bw)     dev.zugriff.podcasts.bw   podcasts-202612011212-bw.apk
//
// the stamp is the build's minute, yyyymmddhhmm in berlin time (stampOf).

import { registry } from './../../.shared/js/data/apps.js';

const SUFFIXES = { bubblewrap: 'bw', capacitor: '', 'capacitor-live': 'live' };
const VARIANTS = Object.keys(SUFFIXES);

// a valid android package segment: only [a-zA-Z0-9_], never leading with a digit
const segmentOf = text => text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a$1');

const variantsOf = app => [app?.build?.android ?? []].flat();

function check (app, variant) {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown android variant "${variant}"`);
  if (!variantsOf(app).includes(variant)) throw new Error(`"${app.slug}" is not built as ${variant}`);
}

// '', 'dev', 'live' or 'bw'
function suffixOf (variant, dev = false) {
  if (dev && variant !== 'capacitor') throw new Error(`a dev build is capacitor only, not ${variant}`);
  return dev ? 'dev' : SUFFIXES[variant];
}

function idOf (app, variant, { dev = false, prefix = process.env.APP_ID_PREFIX || 'dev.zugriff' } = {}) {
  check(app, variant);
  const suffix = suffixOf(variant, dev);
  return `${prefix}.${segmentOf(app.slug)}${suffix ? `.${suffix}` : ''}`;
}

function nameOf (app, variant, { dev = false } = {}) {
  check(app, variant);
  const suffix = suffixOf(variant, dev);
  const name   = app.short_name || app.name || app.slug;
  return suffix ? `${name} (${suffix})` : name;
}

// the apk/aab file name without extension
function fileOf (slug, variant, stamp, { dev = false } = {}) {
  const suffix = suffixOf(variant, dev);
  return `${slug}-${stamp}${suffix ? `-${suffix}` : ''}`;
}

// the build's minute in berlin time, 202612011212
function stampOf (date = new Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin', year: 'numeric' }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
}

// the slugs built as `variant`, all of them or the one asked for
const slugsFor = (variant, only) => registry
  .getAll('app')
  .filter(app => variantsOf(app).includes(variant))
  .filter(app => !only || app.slug === only)
  .map(app => app.slug);

export { fileOf, idOf, nameOf, segmentOf, slugsFor, stampOf, suffixOf, VARIANTS, variantsOf };
