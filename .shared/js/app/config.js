// .shared/js/app/config.js

import { registry } from './../data/apps.js';

const slug   = new URL(import.meta.url).searchParams.get('slug');
const config = (slug && registry.get(slug)) || {};

// :::::: EXPORT

export { config };
export default config;
