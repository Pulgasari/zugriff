// .github/scripts/android.js
// the android build variants of the registry entries. build.android is one
// variant or a list of them:
//
//   build: { android: 'capacitor' }
//   build: { android: ['capacitor', 'capacitor-live'] }
//
// the first variant is the app's main one and keeps the plain id
// dev.zugriff.<slug>, every other one gets its variant appended
// (dev.zugriff.<slug>.capacitor_live), so the variants of an app install side by
// side. the same goes for the name: the others carry their variant in it.

import { registry } from './../../.shared/js/data/apps.js';

const VARIANTS = ['bubblewrap', 'capacitor', 'capacitor-live'];

// a valid android package segment: only [a-zA-Z0-9_], never leading with a digit
const segmentOf = text => text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a$1');

const variantsOf = app => [app?.build?.android ?? []].flat();

function check (app, variant) {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown android variant "${variant}"`);
  if (!variantsOf(app).includes(variant)) throw new Error(`"${app.slug}" is not built as ${variant}`);
}

function idOf (app, variant, prefix = process.env.APP_ID_PREFIX || 'dev.zugriff') {
  check(app, variant);
  const id = `${prefix}.${segmentOf(app.slug)}`;
  return variantsOf(app)[0] === variant ? id : `${id}.${segmentOf(variant)}`;
}

function nameOf (app, variant) {
  check(app, variant);
  const name = app.short_name || app.name || app.slug;
  return variantsOf(app)[0] === variant ? name : `${name} (${variant})`;
}

// the slugs built as `variant`, all of them or the one asked for
const slugsFor = (variant, only) => registry
  .getAll('app')
  .filter(app => variantsOf(app).includes(variant))
  .filter(app => !only || app.slug === only)
  .map(app => app.slug);

export { idOf, nameOf, segmentOf, slugsFor, VARIANTS, variantsOf };
