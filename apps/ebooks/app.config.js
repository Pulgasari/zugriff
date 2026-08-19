// apps/ebooks/app.config.js
//
// everything user-facing (name, icon, description) comes from apps/registry.js
// so the launcher and the app can never drift apart.

import { registry } from './../registry.js';
export const app = registry.get('ebooks');

export const aufbau = {
  elements : { mode: 'auto' },
};
