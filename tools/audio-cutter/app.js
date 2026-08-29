// tools/audio-cutter/app.js

// ::: vendors
import { html, signal, useEffect, useRef } from '@aufbau/kits/preact-htm';
import { fetchFile } from '@ffmpeg/util';

// ::: shared
import { boot, config } from '/.shared/js/app.js?slug=audio-cutter';
import { loadFFmpeg } from '/.shared/js/lib/ffmpeg.js';
import { Dropzone, Icon } from '/.shared/js/components/index.js';
import { WaveformWithHandles } from '/.shared/js/components/media.js';

// ::: local

// Still returns

// ── state ─────────────────────────────────────────────────────────────────────
let audioFile = signal(null);
let duration  = signal(0);
let startSig  = signal(0);
let endSig    = signal(0);
let peaks     = signal(null);
let playing   = signal(false);
let playPos   = signal(0);       // normalized 0..1
let status    = signal('idle');  // idle | loading | converting | done | error
let blobUrl   = signal(null);
let outName   = signal('');
let errMsg    = signal('');
let ffLoading = signal(false);
let ffReady   = signal(false);

let ff, audioCtx, audioBuffer, sourceNode, rafId;
let playOffset = 0, playStartAt = 0;

// ── ffmpeg ────────────────────────────────────────────────────────────────────
async function ensureFF() {
  if (ffReady.value) return;
  ffLoading.value = true;
  try {
    ff = await loadFFmpeg();
    ffReady.value = true;
  } finally {
    ffLoading.value = false;
  }
}

// ── file loading ──────────────────────────────────────────────────────────────
async function loadFile(file) {
  stopPlay();
  peaks.value    = null;
  blobUrl.value  = null;
  status.value   = 'loading';
  audioFile.value = file;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    audioBuffer = await audioCtx.decodeAudioData(await file.arrayBuffer());

    let ch = audioBuffer.getChannelData(0);
    let N  = 600;
    let bs = Math.floor(ch.length / N);
    let pk = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let max = 0;
      for (let j = 0; j < bs; j++) { let v = Math.abs(ch[i*bs+j]); if (v > max) max = v; }
      pk[i] = max;
    }

    duration.value = audioBuffer.duration;
    startSig.value = 0;
    endSig.value   = audioBuffer.duration;
    playPos.value  = 0;
    peaks.value    = pk;
    status.value   = 'idle';
  } catch(e) { status.value = 'error'; errMsg.value = e.message; }
}

// ── playback ──────────────────────────────────────────────────────────────────
function stopPlay() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (sourceNode) { try { sourceNode.stop(); } catch(_) {} sourceNode = null; }
  playing.value = false;
}
function startPlay() {
  if (!audioBuffer) return;
  stopPlay();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  let s = startSig.value, e = endSig.value;
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioCtx.destination);
  playOffset  = s;
  playStartAt = audioCtx.currentTime;
  sourceNode.start(0, s, e - s);
  playing.value = true;

  let tick = () => {
    let t = playOffset + (audioCtx.currentTime - playStartAt);
    playPos.value = Math.min(t, e) / duration.value;
    if (t >= e) { stopPlay(); playPos.value = s / duration.value; return; }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  sourceNode.onended = () => { if (playing.value) { stopPlay(); playPos.value = s / duration.value; }};
}
let togglePlay = () => playing.value ? stopPlay() : startPlay();

// ── convert ───────────────────────────────────────────────────────────────────
async function doConvert() {
  await ensureFF();
  status.value = 'converting';
  try {
    let file = audioFile.value;
    let ext  = file.name.split('.').pop().toLowerCase();
    let inN  = 'in.' + ext, outN = 'out.' + ext;

    await ff.writeFile(inN, await fetchFile(file));
    await ff.exec([
      '-i', inN,
      '-ss', startSig.value.toFixed(3),
      '-to', endSig.value.toFixed(3),
      '-c', 'copy',
      outN
    ]);

    let data = await ff.readFile(outN);
    blobUrl.value = URL.createObjectURL(new Blob([data.buffer], { type: file.type }));
    outName.value = file.name.replace(/\.([^.]+)$/, '_cut.$1');
    await ff.deleteFile(inN);
    await ff.deleteFile(outN);
    status.value = 'done';
  } catch(e) { status.value = 'error'; errMsg.value = e.message; }
}

// ── utils ─────────────────────────────────────────────────────────────────────
let fmt = s => Math.floor(s/60) + ':' + (s%60).toFixed(1).padStart(4,'0');


// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let file = audioFile.value;
  let st   = status.value;
  let dur  = duration.value;
  let busy = st === 'converting' || ffLoading.value;

  let reset = () => { stopPlay(); audioFile.value = null; peaks.value = null; blobUrl.value = null; status.value = 'idle'; playPos.value = 0; };
  
  let handleWaveformChange = (type, time) => {
    (type === 'start')
    ? startSig.value = Math.min(time,   endSig.value - 0.1)
    :   endSig.value = Math.max(time, startSig.value + 0.1);
  };
  
  return html`
    <div id="app-body">

      ${!file ? html`<${Dropzone} accept='audio/*' multiple=${false} what='an audio file' onFiles=${entries => loadFile(entries[0].file)} />` : html`

        <div class="file-bar">
          <${Icon} name="mdi:music-note-outline" />
          <span class="fname">${file.name}</span>
          <span class="dur">${fmt(dur)}</span>
          <button class="icon-btn remove" onClick=${reset} title="Remove">
            <${Icon} name="mdi:close" />
          </button>
        </div>

        ${st === 'loading' && html`
          <div class="info-row"><${Icon} name="mdi:loading" className="spin" /> Decoding…</div>`}

        ${peaks.value && html`
          <${WaveformWithHandles} 
            peaks=${peaks.value}
            start=${startSig.value}
            end=${endSig.value}
            duration=${duration.value}
            playPos=${playPos.value}
            onChange=${handleWaveformChange}
          />

          <div class="time-row">
            <div class="time-field">
              <label>Start</label>
              <input type="number" min="0" step="0.1" max=${(endSig.value-.1).toFixed(1)}
                value=${startSig.value.toFixed(1)}
                onInput=${e => startSig.value = Math.max(0, Math.min(+e.target.value, endSig.value-.1))} />
              <span class="time-fmt">${fmt(startSig.value)}</span>
            </div>
            <div class="sel-dur"><${Icon} name="mdi:scissors-cutting" />${fmt(endSig.value - startSig.value)}</div>
            <div class="time-field">
              <label>End</label>
              <input type="number" step="0.1" min=${(startSig.value+.1).toFixed(1)} max=${dur.toFixed(1)}
                value=${endSig.value.toFixed(1)}
                onInput=${e => endSig.value = Math.min(dur, Math.max(+e.target.value, startSig.value+.1))} />
              <span class="time-fmt">${fmt(endSig.value)}</span>
            </div>
          </div>

          <div class="actions">
            <button class="btn icon-only" onClick=${togglePlay} title=${playing.value ? 'Pause' : 'Preview'}>
              <${Icon} name=${playing.value ? 'mdi:pause' : 'mdi:play'} size="20" />
            </button>
            <button class="btn primary" onClick=${doConvert} disabled=${busy}>
              <${Icon} name=${busy ? 'mdi:loading' : 'mdi:content-cut'} className=${busy ? 'spin' : ''} />
              ${ffLoading.value ? 'Loading ffmpeg…' : st === 'converting' ? 'Cutting…' : 'Cut & export'}
            </button>
            ${st === 'done' && blobUrl.value && html`
              <a class="btn secondary" href=${blobUrl.value} download=${outName.value}>
                <${Icon} name="mdi:download" /> Download
              </a>`}
          </div>

          ${st === 'error' && html`
            <div class="err-row"><${Icon} name="mdi:alert-circle-outline" /> ${errMsg.value}</div>`}
        `}
      `}
    </div>`;
}

boot({ config, App });
