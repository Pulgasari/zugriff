// .shared/js/app/state.js

// :::::: IMPORTS

import { deepSignal } from '@aufbau/signals';
import { registry }   from './../registry.js';

const slug   = new URL(import.meta.url).searchParams.get('slug');
const config = (slug && registry.get(slug)) || {};

// :::::: REFS

const $doc  = (typeof document !== 'undefined') ? document : null;    
const $root = (typeof document !== 'undefined') ? document.documentElement : null;    

// :::::: MAIN

const state = deepSignal({
  ...config,
  dir    : 'ltr',
  dialog : null,
  route  : null,
  font   : 'Manrope',
});

// :::::: EFFECTS

state.$onEffects ({
  dir   : (value) => $root?.setAttribute('dir', value),
  font  : (value) => aufbau.webfonts.init({ name: value, target: '--font' }),
  lang  : (value) => $root.lang = value,
  theme : (value) => $root.dataset.theme = value,
  title : (value) => $doc.title = value,
});

// :::::: EXPORT

export       { state };
export default state;
