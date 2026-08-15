(() => {


const createElement = (tag, props) => Object.assign(document.createElement(tag), props);    

const PRELOAD_CRITICAL = [
  '@bunker/core',
  '@bunker/policy',
  '@domina/core',
  '@aufbau/elements',
  '@aufbau/kits',
];

const pkg = 'https://code.pulgasari.dev';
const map = { imports: {
  "@aufbau/builders/docs"   : `${pkg}/aufbau/builders/docs/index.js`,
  "@aufbau/builders/docs/"  : `${pkg}/aufbau/builders/docs/`,
  "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
  "@aufbau/elements/"       : `${pkg}/aufbau/elements/`,
  "@aufbau/filters"         : `${pkg}/aufbau/filters/index.js`,
  "@aufbau/import"          : `${pkg}/aufbau/import/index.js`,
  "@aufbau/js"              : `${pkg}/aufbau/js/index.js`,
  "@aufbau/kits/preact-htm" : `${pkg}/aufbau/kits/preact-htm.js`,
  "@aufbau/patterns"        : `${pkg}/aufbau/patterns/index.js`,
  "@aufbau/runtime"         : `${pkg}/aufbau/runtime/index.js`,
  "@aufbau/runtime/"        : `${pkg}/aufbau/runtime/`,
  "@aufbau/store"           : `${pkg}/aufbau/store/index.js`,
  "@aufbau/stylesheet"      : `${pkg}/aufbau/stylesheet/index.js`,
  "@aufbau/stylesheet/"     : `${pkg}/aufbau/stylesheet/`,
  "@aufbau/svg/"            : `${pkg}/aufbau/svg/`,
  "@aufbau/utils"           : `${pkg}/aufbau/js/index.js`,

  "@bunker/cache"   : `${pkg}/bunker/cache/index.js`,
  "@bunker/core"    : `${pkg}/bunker/core/index.js`,
  "@bunker/db"      : `${pkg}/bunker/db/index.js`,
  "@bunker/kit"     : `${pkg}/bunker/kit/index.js`,
  "@bunker/policy"  : `${pkg}/bunker/policy/index.js`,
  "@bunker/storage" : `${pkg}/bunker/storage/index.js`,
  "@bunker/utils"   : `${pkg}/bunker/utils/index.js`,
  "@bunker/utils/"  : `${pkg}/bunker/utils/`,

  "@cosmonaut/compiler" : `${pkg}/cosmonaut/packages/compiler/index.js`,
  "@cosmonaut/ebnf"     : `${pkg}/cosmonaut/packages/ebnf/index.js`,
  "@cosmonaut/layouter" : `${pkg}/cosmonaut/packages/layouter/index.js`,
  "@cosmonaut/lsd"      : `${pkg}/cosmonaut/packages/lsd/index.js`,
  "@cosmonaut/parsers"  : `${pkg}/cosmonaut/packages/parsers/index.js`,
  "@cosmonaut/parsers/" : `${pkg}/cosmonaut/packages/parsers/`,
  "@cosmonaut/layouter/": `${pkg}/cosmonaut/packages/layouter/`,
  "@cosmonaut/compiler/": `${pkg}/cosmonaut/packages/compiler/`,

  "@domina/core" : `${pkg}/domina/core/index.js`,
  
  "@poo/compiler" : `${pkg}/poo/js-packages/compiler/index.js`,
  "@poo/hljs"     : `${pkg}/poo/js-packages/hljs/index.js`,

  "@pulgasari/is"     : `${pkg}/js/is.js`,
  "@pulgasari/logger" : `${pkg}/js/logger.js`,
  "@pulgasari/random" : `${pkg}/js/random.js`,
  "@pulgasari/str"    : `${pkg}/js/str.js`,
  "@pulgasari/timing" : `${pkg}/js/timing.js`,
  "@pulgasari/url"    : `${pkg}/js/url.js`,

  "htm"              : "https://esm.sh/htm@3.1.1",
  "preact"           : "https://esm.sh/preact@10.20.1",
  "preact/hooks"     : "https://esm.sh/preact@10.20.1/hooks",
  "@preact/signals"  : "https://esm.sh/@preact/signals@1.2.2?external=preact",
    
  "hljs" : "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm"
}};

const mapURL = document.currentScript?.src;
if (!mapURL) throw new Error('[aufbau] importmap injector must be a classic script');

// rebase relative urls against this file, not the host page
const rebase = m => { for (const k in m) m[k] = new URL(m[k], mapURL).href; return m; };
rebase(map.imports);
//for (const scope in map.scopes ?? {}) rebase(map.scopes[scope]);

document.currentScript.after(
  createElement('script', { type: 'importmap', textContent: JSON.stringify(map) })
);




// Inject <link rel="modulepreload"> for critical modules
const fragment = document.createDocumentFragment();
for (const key of PRELOAD_CRITICAL) {
  const href = map.imports[key];
  if (href) {
    const link = createElement('link', { href, rel: 'modulepreload' });
    fragment.appendChild(link);
  }
}

if (fragment.childNodes.length > 0) {
  document.head.appendChild(fragment);
}

})();
