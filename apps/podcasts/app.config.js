// apps/podcasts/app.config.js
//
// everything user-facing (name, icon, description) comes from apps/registry.js
// so the launcher and the app can never drift apart.

import { appMeta } from './../registry.js';
export const app = appMeta('podcasts');

//import { podcasts } from './../registry.js';
//export const app = podcasts;

export const aufbau = {
  elements : { mode: 'auto' },
};
