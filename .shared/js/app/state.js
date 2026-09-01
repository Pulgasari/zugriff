// .shared/js/app/state.js

// :::::: IMPORTS

import { deepSignal } from '@aufbau/signals';
import { registry }   from './../data/registry.js';

const slug   = new URL(import.meta.url).searchParams.get('slug');
const config = (slug && registry.get(slug)) || {};

// :::::: REFS

const $doc  = (typeof document !== 'undefined') ? document : null;    
const $root = (typeof document !== 'undefined') ? document.documentElement : null;    

// :::::: MAIN

const state = deepSignal({
  color    : config.color,
  dir      : config.dir,
  font     : 'Manrope',
  lang     : config.lang,
  theme    : config.theme,
  viewport : config.viewport,

  //
  dialog : null,
  route  : null,
});

// :::::: EFFECTS

state.$onEffects ({
  color    : (value) => {},
  dir      : (value) => $root?.setAttribute('dir', value),
  font     : (value) => aufbau.webfonts.init({ name: value, target: '--font' }),
  lang     : (value) => $root.lang = value,
  theme    : (value) => $root.dataset.theme = value,
  title    : (value) => $doc.title = value,
  viewport : (value) => {},
});

// :::::: EXPORT

export       { state };
export default state;
