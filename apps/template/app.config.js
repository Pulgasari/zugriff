// apps/template/app.config.js
//
// the app's own knobs. everything user-facing (name, icon, description) comes
// from apps/registry.js so the launcher and the app can never drift apart —
// a real app replaces the literal below with:
//
//   import { appMeta } from './../registry.js';
//   export const app = appMeta('my-slug');

import { defaults } from './../registry.js';

export const app = {
  ...defaults,
  slug        : 'template',
  name        : 'template',
  icon        : 'mdi:cube-outline',
  description : 'the blueprint every app is copied from.',
};

export const aufbau = {
  elements : { mode: 'auto' },
};
