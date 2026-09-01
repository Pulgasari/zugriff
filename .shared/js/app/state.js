// .shared/js/app/state.js

// :::::: IMPORTS

import { deepSignal } from '@aufbau/signals';

// :::::: REFS

const $root = (typeof document !== 'undefined') ? document.documentElement : null;    

// :::::: MAIN

const state = deepSignal({
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
