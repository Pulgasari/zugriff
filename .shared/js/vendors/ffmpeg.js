// shared/js/lib/ffmpeg.js
//
// one loader for the three audio apps. the ~32 mb core wasm is not in this
// repo — it comes off the cdn on first use and the service worker keeps it
// from there on, so the app is offline capable from the second run.
//
//   const ff = await loadFFmpeg({ onProgress: p => …});

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// the core has to be same-origin for the worker, hence the blob urls
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/';

let instance = null;
let loading  = null;

/** resolves to a loaded FFmpeg — concurrent callers share one instance */
export function loadFFmpeg ({ onLog, onProgress } = {}) {
  if (instance) return Promise.resolve(instance);

  loading ??= (async () => {
    const ff = new FFmpeg();
    if (onLog)      ff.on('log', onLog);
    if (onProgress) ff.on('progress', onProgress);

    await ff.load({
      coreURL : await toBlobURL(CORE_BASE + 'ffmpeg-core.js',   'text/javascript'),
      wasmURL : await toBlobURL(CORE_BASE + 'ffmpeg-core.wasm', 'application/wasm'),
    });

    instance = ff;
    return ff;
  })().catch(error => { loading = null; throw error; });

  return loading;
}

export const ffmpeg = () => instance;
