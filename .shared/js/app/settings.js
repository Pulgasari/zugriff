// .shared/js/app/config.js

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
