// .shared/js/data/importmap.js
// the importmap of every page. a classic script ahead of boot.js, which injects it.
// bundler.config.js reads it as well

globalThis.__IMPORTMAP__ = (() => {

const pkg    = 'https://code.pulgasari.dev';
const jsr    = 'https://esm.sh/jsr';
const HLJS   = '11.10.0';
const PREACT = '10.20.1';

return {
  "@aufbau/api"             : `${pkg}/aufbau/api/index.js`,
  "@aufbau/ass"             : `${pkg}/aufbau/ass/index.js`,
  "@aufbau/ass/"            : `${pkg}/aufbau/ass/`,
  "@aufbau/builders/docs"   : `${pkg}/aufbau/builders/docs/index.js`,
  "@aufbau/builders/docs/"  : `${pkg}/aufbau/builders/docs/`,
  "@aufbau/devtools"        : `${pkg}/aufbau/devtools/index.js`,
  "@aufbau/devtools/"       : `${pkg}/aufbau/devtools/`,
  "@aufbau/element"         : `${pkg}/aufbau/element/index.js`,
  "@aufbau/element/"        : `${pkg}/aufbau/element/`,
  "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
  "@aufbau/elements/htx"    : `${pkg}/aufbau/elements/adapters/htx.js`,
  "@aufbau/elements/"       : `${pkg}/aufbau/elements/`,
  "@aufbau/filters"         : `${pkg}/aufbau/filters/index.js`,
  "@aufbau/gestalt"         : `${pkg}/aufbau/gestalt/index.js`,
  "@aufbau/gestalt/"        : `${pkg}/aufbau/gestalt/`,
  "@aufbau/gestures"        : `${pkg}/aufbau/gestures/index.js`,
  "@aufbau/gestures/preact" : `${pkg}/aufbau/gestures/adapters/preact.js`,
  "@aufbau/gui"             : `${pkg}/aufbau/gui/index.js`,
  "@aufbau/import"          : `${pkg}/aufbau/import/index.js`,
  "@aufbau/patterns"        : `${pkg}/aufbau/patterns/index.js`,
  "@aufbau/signals"         : `${pkg}/aufbau/signals/index.js`,
  "@aufbau/signals/"        : `${pkg}/aufbau/signals/`,
  "@aufbau/store"           : `${pkg}/aufbau/store/index.js`,
  "@aufbau/svg"             : `${pkg}/aufbau/svg/index.js`,
  "@aufbau/svg/"            : `${pkg}/aufbau/svg/`,
  "@aufbau/webfonts"        : `${pkg}/aufbau/webfonts/index.js`,
  "@aufbau/webfonts/"       : `${pkg}/aufbau/webfonts/`,
  "@aufbau/webfonts/google" : `${pkg}/aufbau/webfonts/google.js`,

  "@bunker/cache"   : `${pkg}/bunker/cache/index.js`,
  "@bunker/core"    : `${pkg}/bunker/core/index.js`,
  "@bunker/db"      : `${pkg}/bunker/db/index.js`,
  "@bunker/kit"     : `${pkg}/bunker/kit/index.js`,
  "@bunker/opfs"    : `${pkg}/bunker/opfs/index.js`,
  "@bunker/policy"  : `${pkg}/bunker/policy/index.js`,
  "@bunker/storage" : `${pkg}/bunker/storage/index.js`,
  "@bunker/utils"   : `${pkg}/bunker/utils/index.js`,
  "@bunker/utils/"  : `${pkg}/bunker/utils/`,

  "@domina/core"         : `${pkg}/domina/core/index.js`,
  "@domina/core/"        : `${pkg}/domina/core/`,
  "@domina/element"      : `${pkg}/domina/packages/element/index.js`,
  "@domina/element/lazy" : `${pkg}/domina/packages/element/lazy.js`,
  "@domina/fonts"        : `${pkg}/domina/packages/fonts/index.js`,
  "@domina/form"         : `${pkg}/domina/packages/form/index.js`,
  "@domina/meta"         : `${pkg}/domina/packages/meta/index.js`,
  "@domina/methods"      : `${pkg}/domina/packages/methods/index.js`,
  "@domina/methods/"     : `${pkg}/domina/packages/methods/`,
  "@domina/observer"     : `${pkg}/domina/packages/observer/index.js`,
  "@domina/raf"          : `${pkg}/domina/packages/raf/index.js`,
  "@domina/stylesheet"   : `${pkg}/domina/packages/stylesheet/index.js`,

  "@htx/compiler" : `${pkg}/htx/packages/compiler/index.js`,
  "@htx/elements" : `${pkg}/htx/packages/elements/index.js`,
  "@htx/htx"      : `${pkg}/htx/packages/htx/index.js`,
  "@htx/js"       : `${pkg}/htx/packages/js/index.js`,
  "@htx/preact"   : `${pkg}/htx/packages/preact/index.js`,

  "@poo/compiler" : `${pkg}/poo/js-packages/compiler/index.js`,
  "@poo/hljs"     : `${pkg}/poo/js-packages/hljs/index.js`,

  "@pulgasari/arr"              : `${pkg}/js-packages/arr/index.js`,
  "@pulgasari/arr/fp"           : `${pkg}/js-packages/arr/fp.js`,
  "@pulgasari/canonicalmap"     : `${pkg}/js-packages/obj/CanonicalMap.js`,
  "@pulgasari/coerce"           : `${pkg}/js-packages/coerce/index.js`,
  "@pulgasari/hash"             : `${pkg}/js-packages/hash/index.js`,
  "@pulgasari/is"               : `${jsr}/@pulgasari/is`,
  "@pulgasari/logger"           : `${jsr}/@pulgasari/logger`,
  "@pulgasari/num"              : `${pkg}/js-packages/num/index.js`,
  "@pulgasari/obj"              : `${pkg}/js-packages/obj/index.js`,
  "@pulgasari/obj/CanonicalMap" : `${pkg}/js-packages/obj/CanonicalMap.js`,
  "@pulgasari/random"           : `${pkg}/js-packages/random/index.js`,
  "@pulgasari/shift"            : `${pkg}/js-packages/shift/index.js`,
  "@pulgasari/str"              : `${jsr}/@pulgasari/str`,
  "@pulgasari/timing"           : `${pkg}/js-packages/timing/index.js`,
  "@pulgasari/url"              : `${pkg}/js-packages/url/index.js`,

  // preact once: whatever depends on it pins PREACT, so esm.sh ships no second copy
  "acorn"           : "https://esm.sh/acorn@8",
  "htm"             : "https://esm.sh/htm@3.1.1",
  "preact"          : `https://esm.sh/preact@${PREACT}`,
  "preact/hooks"    : `https://esm.sh/preact@${PREACT}/hooks`,
  "@preact/signals" : "https://esm.sh/@preact/signals@1.2.2?external=preact",

  "hljs"                    : `https://esm.sh/highlight.js@${HLJS}`,
  "highlight.js"            : `https://esm.sh/highlight.js@${HLJS}/lib/core`,
  "highlight.js/languages/" : `https://esm.sh/highlight.js@${HLJS}/lib/languages/`,

  "@xterm/addon-fit" : "https://esm.sh/@xterm/addon-fit@0.10.0",
  "@xterm/xterm"     : "https://esm.sh/@xterm/xterm@5.5.0",

  "smol-toml" : "https://esm.sh/smol-toml@1.3.1",
  "yaml"      : "https://esm.sh/yaml@2.4.5",

  "csso"                 : "https://esm.sh/csso@5.0.5",
  "html-minifier-terser" : "https://esm.sh/html-minifier-terser@7.2.0",
  "terser"               : "https://esm.sh/terser@5.31.1",

  "pdf-lib"      : "https://esm.sh/pdf-lib@1.17.1",
  "pdfjs"        : "https://esm.sh/pdfjs-dist@4.4.168",
  "pdfjs-worker" : "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs",
  "epubjs"       : "https://esm.sh/epubjs@0.3.93",

  // the ffmpeg core wasm (~32 mb) comes from the cdn on first use, the service worker keeps it
  "@ffmpeg/ffmpeg" : "https://esm.sh/@ffmpeg/ffmpeg@0.12.10",
  "@ffmpeg/util"   : "https://esm.sh/@ffmpeg/util@0.12.1",
  "@ffmpeg/core"   : "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
  "upng-js"        : "https://esm.sh/upng-js@2.1.0",
  "music-metadata" : "https://esm.sh/music-metadata@11",

  "culori" : "https://esm.sh/culori@3.3.0",

  "@mediapipe/tasks-vision" : "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm",
};

})();
