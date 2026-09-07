// apps/code/monaco.js
//
// load Monaco from a versioned CDN via its own AMD loader, not through the
// import map. the reason: esm.sh's `monaco-editor@x/…?worker` builds are broken
// (`QE is not a function` in ts.worker) and the shared service worker chokes on
// streaming/opaque esm.sh responses ("body is locked"). the AMD `min/vs` layout
// ships plain, un-transpiled worker scripts and its files cache cleanly, so this
// is the reliable way to run Monaco on a static, no-bundler site.
//
// workers can't be cross-origin, so getWorkerUrl hands Monaco a same-origin blob
// that importScripts the real worker from the CDN — the standard CDN pattern.

const VER  = '0.50.0';
const VS   = `https://cdn.jsdelivr.net/npm/monaco-editor@${VER}/min/vs`;
const BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${VER}/min/`;

let promise;

export function loadMonaco () {
  return (promise ??= new Promise((resolve, reject) => {
    const workerBlob = URL.createObjectURL(new Blob(
      [ `self.MonacoEnvironment = { baseUrl: '${BASE}' };\n`,
        `importScripts('${VS}/base/worker/workerMain.js');` ],
      { type: 'text/javascript' },
    ));
    self.MonacoEnvironment = { getWorkerUrl: () => workerBlob };

    const script = document.createElement('script');
    script.src   = `${VS}/loader.js`;
    script.onload = () => {
      // the AMD loader defines a global `require`; point it at the CDN and pull
      // in the editor (which also injects Monaco's stylesheet)
      window.require.config({ paths: { vs: VS } });
      window.require(['vs/editor/editor.main'], () => {
        self.monaco = window.monaco;   // editor.js reads the namespace off self.monaco
        resolve(window.monaco);
      }, reject);
    };
    script.onerror = () => reject(new Error('[code] failed to load Monaco loader'));
    document.head.appendChild(script);
  }));
}

export default loadMonaco;
