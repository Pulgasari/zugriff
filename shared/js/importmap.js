(() => {


const createElement = (tag, props) => Object.assign(document.createElement(tag), props);    

const PRELOAD_CRITICAL = [
  '@aufbau/kits/preact-htm',
  '@aufbau/elements',
  '@domina/core',
  'preact',
];

const pkg = 'https://code.pulgasari.dev';

// pinned once so every dependent entry below refers to the same version
const PREACT = '10.20.1';
const HLJS   = '11.10.0';

const map = { imports: {
  "@aufbau/builders/docs"   : `${pkg}/aufbau/builders/docs/index.js`,
  "@aufbau/builders/docs/"  : `${pkg}/aufbau/builders/docs/`,
  "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
  "@aufbau/elements/"       : `${pkg}/aufbau/elements/`,
  "@aufbau/filters"         : `${pkg}/aufbau/filters/index.js`,
  "@aufbau/import"          : `${pkg}/aufbau/import/index.js`,
  "@aufbau/js"              : `${pkg}/aufbau/js/index.js`,
  "@aufbau/js/"             : `${pkg}/aufbau/js/`,
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

  // ::: preact + htm
  // one preact instance only — everything that depends on preact is pinned to
  // PREACT via ?external= or ?deps=, otherwise esm.sh ships a second copy and
  // hooks/signals silently stop working
  "htm"              : "https://esm.sh/htm@3.1.1",
  "htm/preact"       : `https://esm.sh/htm@3.1.1/preact?deps=preact@${PREACT}`,
  "preact"           : `https://esm.sh/preact@${PREACT}`,
  "preact/hooks"     : `https://esm.sh/preact@${PREACT}/hooks`,
  "preact/jsx-runtime": `https://esm.sh/preact@${PREACT}/jsx-runtime`,
  "@preact/signals"  : "https://esm.sh/@preact/signals@1.2.2?external=preact",

  // ::: syntax highlighting
  "hljs"                    : "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm",
  "highlight.js"            : `https://esm.sh/highlight.js@${HLJS}/lib/core`,
  "highlight.js/languages/" : `https://esm.sh/highlight.js@${HLJS}/lib/languages/`,

  // ::: terminal (cli)
  "@xterm/addon-fit" : "https://esm.sh/@xterm/addon-fit@0.10.0",
  "@xterm/xterm"     : "https://esm.sh/@xterm/xterm@5.5.0",

  // ::: data formats
  "smol-toml" : "https://esm.sh/smol-toml@1.3.1",
  "yaml"      : "https://esm.sh/yaml@2.4.5",

  // ::: minifiers
  "csso"                 : "https://esm.sh/csso@5.0.5",
  "html-minifier-terser" : "https://esm.sh/html-minifier-terser@7.2.0",
  "terser"               : "https://esm.sh/terser@5.31.1",

  // ::: documents
  "pdf-lib"      : "https://esm.sh/pdf-lib@1.17.1",
  "pdfjs"        : "https://esm.sh/pdfjs-dist@4.4.168",
  "pdfjs-worker" : "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs",

  // ::: media
  // the ffmpeg core wasm is ~32 mb and stays off this repo — it is fetched
  // from the cdn on first use and the service worker keeps it from there on
  "@ffmpeg/ffmpeg" : "https://esm.sh/@ffmpeg/ffmpeg@0.12.10",
  "@ffmpeg/util"   : "https://esm.sh/@ffmpeg/util@0.12.1",
  "@ffmpeg/core"   : "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
  "upng-js"        : "https://esm.sh/upng-js@2.1.0",
  "gifenc"         : "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm",

  // ::: color
  "culori" : "https://esm.sh/culori@3.3.0",
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
