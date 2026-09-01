// .shared/js/app/state.js

// :::::: IMPORTS

import { deepSignal } from '@aufbau/signals';
import { registry }   from './../registry.js';

const slug   = new URL(import.meta.url).searchParams.get('slug');
const config = (slug && registry.get(slug)) || {};

// :::::: REFS

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
  dir  : (value) => $root?.setAttribute('dir', value),
  font : (value) => aufbau.webfonts.init({ name: value, target: '--font' }),
});

// :::::: EXPORT

export       { state };
export default state;
