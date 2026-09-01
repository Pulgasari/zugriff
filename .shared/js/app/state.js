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

effect(() => $root?.setAttribute('dir', state.route.value));

effect(() => aufbau.webfonts.init({ name: state.font.value, target: '--font' }));

state.onEffects ({
  dir  : (value) => $root?.setAttribute('dir', value),
  font : (value) => aufbau.webfonts.init({ name: value, target: '--font' }),
});


// :::::: EXPORT

export       { state };
export default state;




function onUpdate (key, callback) {
  effect(() => {
    const value = state[key].value;
    callback(value);
  });
}


state.onEffect = function (key, callback) {
  effect(() => {
    if (!(key in state)) return;
    const value = state[key];
    // prevent callback internal signal reads from leaking into this effect
    untracked(() => callback(value));
  });
}

state.onEffects = function (listeners) {
  Object.entries(listeners).forEach(([key, callback]) => onEffect(key, callback));
}

effect(() => $root?.setAttribute('dir', state.route.value));

onUpdate('dir',  (value) => $root?.setAttribute('dir', value));
onUpdate('font', (value) => aufbau.webfonts.init({ name: value, target: '--font' }));

state.onEffects ({
  key  : (value) => $root?.setAttribute('dir', value),
  font : (value) => aufbau.webfonts.init({ name: value, target: '--font' })
});
