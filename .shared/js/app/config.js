// .shared/js/app/config.js

import { registry } from './../registry.js';

const slug   = new URL(import.meta.url).searchParams.get('slug');
const config = (slug && registry.get(slug)) || {};

const config = {};

function applyFont (id) {
  if (id) aufbau.webfonts.load(id).then(ok => { 
    if (ok) aufbau.webfonts.apply({ name: id, target: '--font' }); 
  });
}

function applyDir (value) {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = value || 'ltr';
}

// :::::: EXPORT

export { config };
export default config;
