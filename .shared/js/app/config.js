// .shared/js/app/config.js
// resolve a page's registry entry by slug. replaces the old ?slug= module-url
// trick — the slug now comes in as an argument (zugriff.app('notes')).

import { registry } from './../data/apps.js';

export const configFor = slug => (slug && registry.get(slug)) || {};

export default configFor;
