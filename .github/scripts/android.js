// .github/scripts/android.js
// the android build variants of the registry entries. build.android is one
// variant or a list of them:
//
//   build: { android: 'capacitor' }
//   build: { android: ['capacitor', 'capacitor-live'] }
//
//   variant           what                                         name                id                          file
//   bubblewrap        a twa around the live url                    Podcasts (BW)       dev.zugriff.podcasts.bw     podcasts-202612011212-bw.apk
//   capacitor-live    a webview on the live url                    Podcasts (live)     dev.zugriff.podcasts.live   podcasts-202612011212-live.apk
//   capacitor-bundle  the files inside the apk                     Podcasts (bundle)   dev.zugriff.podcasts.bundle podcasts-202612011212-bundle.apk
//   capacitor         the files inside the apk, updated over the   Podcasts            dev.zugriff.podcasts        podcasts-202612011212.apk
//                     air (@capgo/capacitor-updater)
//   capacitor + dev   the same with @aufbau/devtools, no updates   Podcasts (dev)      dev.zugriff.podcasts.dev    podcasts-202612011212-dev.apk
//
// capacitor is the app itself, every other variant carries its mark in name, id
// and file, so all of them install side by side. the stamp is the build's
// minute, yyyymmddhhmm in berlin time (stampOf).

import { registry } from './../../.shared/js/data/apps.js';

// the mark of a variant in the id and file, and in the name
const MARKS = {
  bubblewrap         : { id: 'bw',     name: 'BW'     },
  capacitor          : { id: '',       name: ''       },
  'capacitor-bundle' : { id: 'bundle', name: 'bundle' },
  'capacitor-live'   : { id: 'live',   name: 'live'   },
};
const DEV      = { id: 'dev', name: 'dev' };
const VARIANTS = Object.keys(MARKS);

// a valid android package segment: only [a-zA-Z0-9_], never leading with a digit
const segmentOf = text => text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a$1');

const variantsOf = app => [app?.build?.android ?? []].flat();

function check (app, variant) {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown android variant "${variant}"`);
  if (!variantsOf(app).includes(variant)) throw new Error(`"${app.slug}" is not built as ${variant}`);
}

// the mark of a build: { id, name }, both empty for the app itself
function markOf (variant, dev = false) {
  if (dev && variant !== 'capacitor') throw new Error(`a dev build is capacitor only, not ${variant}`);
  return dev ? DEV : MARKS[variant];
}

// '', 'dev', 'live', 'bundle' or 'bw'
const suffixOf = (variant, dev = false) => markOf(variant, dev).id;

function idOf (app, variant, { dev = false, prefix = process.env.APP_ID_PREFIX || 'dev.zugriff' } = {}) {
  check(app, variant);
  const suffix = suffixOf(variant, dev);
  return `${prefix}.${segmentOf(app.slug)}${suffix ? `.${suffix}` : ''}`;
}

function nameOf (app, variant, { dev = false } = {}) {
  check(app, variant);
  const mark = markOf(variant, dev).name;
  const name = app.short_name || app.name || app.slug;
  return mark ? `${name} (${mark})` : name;
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
  .getAll()
  .filter(app => variantsOf(app).includes(variant))
  .filter(app => !only || app.slug === only)
  .map(app => app.slug);

export { fileOf, idOf, nameOf, segmentOf, slugsFor, stampOf, suffixOf, VARIANTS, variantsOf };
