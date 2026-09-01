// .shared/js/app/state.js

// :::::: IMPORTS

// :::::: REFS

const $root = (typeof document !== 'undefined') ? document.documentElement : null;    

// :::::: MAIN

const state = {
  dialog : null,
  route  : null,
};

// :::::: EFFECTS

effect(() => $root?.setAttribute('dir', state.route.value));

effect(() => {
  const name = state.font.value;
  aufbau.webfonts.load(name).then(ok => {
    if (ok) aufbau.webfonts.apply({ name, target: '--font' }); 
  });
});

// :::::: EXPORT

export       { state };
export default state;
