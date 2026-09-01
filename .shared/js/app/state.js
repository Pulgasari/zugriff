// .shared/js/app/state.js

// :::::: IMPORTS

// :::::: REFS

const $root = (typeof document !== 'undefined') ? document.documentElement : null;    

// :::::: MAIN

const state = {
  dialog : null,
  route  : null,
  font   : 'Manrope',
};

// :::::: EFFECTS

effect(() => $root?.setAttribute('dir', state.route.value));

effect(() => aufbau.webfonts.init({ name: state.font.value, target: '--font' }));

// :::::: EXPORT

export       { state };
export default state;




function onUpdate (key, callback) {
  effect(() => {
    const value = state[key].value;
    callback(value);
  });
}

effect(() => $root?.setAttribute('dir', state.route.value));

onUpdate('dir',  (value) => $root?.setAttribute('dir', value));
onUpdate('font', (value) => aufbau.webfonts.init({ name: value, target: '--font' }));

onUpdate2({
  key  : (value) => $root?.setAttribute('dir', value),
  font : (value) => aufbau.webfonts.init({ name: value, target: '--font' })
});
