// tools/audio-snippets-generator/app.js

// ::: vendors
import { html, signal, useEffect, useRef } from '@aufbau/kits/preact-htm';
import { fetchFile } from '@ffmpeg/util';

// ::: shared
import { boot, config } from '/.shared/js/app.js?slug=audio-snippets-generator';
import { loadFFmpeg } from '/.shared/js/lib/ffmpeg.js';
import { Dropzone, Button, GhostButton, Icon, Picker } from '/.shared/js/components/index.js';
import { WaveformWithHandles } from '/.shared/js/components/media.js';

// ::: local

// ── ffmpeg ────────────────────────────────────────────────────────────────────
let ffReady   = signal(false);
let ffLoading = signal(false);
let ff, audioCtx;

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

function ensureCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── state ─────────────────────────────────────────────────────────────────────
// snippet: { id, file, audioBuffer, peaks, duration, start, end, playPos, playing, _source, _raf }
let snippets   = signal([]);
let format     = signal('mp3');
let exporting  = signal(false);
let previewing = signal(false);
let FORMATS    = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
let MIME       = { mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', m4a:'audio/mp4' };
let _id = 0;

// preview cursor
let prevSource = null, prevRaf = null, prevIdx = 0, prevStartAt = 0, prevOffset = 0;

// ── utils ─────────────────────────────────────────────────────────────────────
let clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let fmtT   = s => Math.floor(s/60) + ':' + (s%60).toFixed(1).padStart(4,'0');
let update = (id, patch) => snippets.value = snippets.value.map(s => s.id === id ? { ...s, ...patch } : s);

// ── load files ────────────────────────────────────────────────────────────────
async function loadFile(file) {
  let ctx = ensureCtx();
  let buf = await ctx.decodeAudioData(await file.arrayBuffer());
  let ch  = buf.getChannelData(0);
  let N   = 400;
  let bs  = Math.floor(ch.length / N);
  let pk  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let max = 0;
    for (let j = 0; j < bs; j++) { let v = Math.abs(ch[i*bs+j]); if (v > max) max = v; }
    pk[i] = max;
  }
  snippets.value = [...snippets.value, {
    id: _id++, file, audioBuffer: buf, peaks: pk,
    duration: buf.duration, start: 0, end: buf.duration,
    playPos: 0, playing: false, _source: null, _raf: null,
  }];
}

let addFiles = list => [...list].forEach(loadFile);

// ── reorder ───────────────────────────────────────────────────────────────────
let moveSnippet = (id, dir) => {
  let arr = [...snippets.value];
  let i   = arr.findIndex(s => s.id === id);
  let j   = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  snippets.value = arr;
};

// ── individual playback ───────────────────────────────────────────────────────
function stopSnippet (id) {
  let s = snippets.value.find(s => s.id === id);
  if (!s) return;
  try { s._source?.stop(); } catch {}
  if (s._raf) cancelAnimationFrame(s._raf);
  update(id, { playing: false, playPos: s.start / s.duration, _source: null, _raf: null });
}
function playSnippet (id) {
  stopSnippet(id);
  let s      = snippets.value.find(s => s.id === id);
  let ctx    = ensureCtx();
  let source = ctx.createBufferSource();
  source.buffer = s.audioBuffer;
  source.connect(ctx.destination);
  let startAt = ctx.currentTime;
  let offset  = s.start;
  source.start(0, offset, s.end - s.start);

  let raf;
  let tick = () => {
    let snap = snippets.value.find(x => x.id === id);
    if (!snap?.playing) return;
    let t = offset + (ctx.currentTime - startAt);
    update(id, { playPos: Math.min(t, snap.end) / snap.duration });
    if (t >= snap.end) { stopSnippet(id); return; }
    raf = requestAnimationFrame(tick);
    update(id, { _raf: raf });
  };
  raf = requestAnimationFrame(tick);
  source.onended = () => stopSnippet(id);
  update(id, { playing: true, _source: source, _raf: raf });
}
let toggleSnippet = id => snippets.value.find(s => s.id === id)?.playing ? stopSnippet(id) : playSnippet(id);

// ── preview (sequential) ──────────────────────────────────────────────────────
function stopPreview () {
  try { prevSource?.stop(); } catch {}
  if (prevRaf) cancelAnimationFrame(prevRaf);
  prevSource = null; prevRaf = null;
  previewing.value = false;
  snippets.value = snippets.value.map(s => ({ ...s, playPos: s.start / s.duration }));
}
function playPreview (idx = 0) {
  let list = snippets.value;
  if (idx >= list.length) { stopPreview(); return; }
  previewing.value = true;
  prevIdx     = idx;
  let s     = list[idx];
  let ctx   = ensureCtx();
  prevSource  = ctx.createBufferSource();
  prevSource.buffer = s.audioBuffer;
  prevSource.connect(ctx.destination);
  prevOffset  = s.start;
  prevStartAt = ctx.currentTime;
  prevSource.start(0, s.start, s.end - s.start);

  let id  = s.id;
  let tick = () => {
    let snap = snippets.value.find(x => x.id === id);
    if (!snap || !previewing.value) return;
    let t = prevOffset + (ctx.currentTime - prevStartAt);
    update(id, { playPos: Math.min(t, snap.end) / snap.duration });
    if (t >= snap.end) { playPreview(idx + 1); return; }
    prevRaf = requestAnimationFrame(tick);
  };
  prevRaf = requestAnimationFrame(tick);
}

// ── export ────────────────────────────────────────────────────────────────────
async function doExport(mode) {
  await ensureFF();
  exporting.value = true;
  let list = snippets.value;
  let fmt  = format.value;
  try {
    if (mode === 'individual') {
      for (let s of list) {
        let ext  = s.file.name.split('.').pop();
        let inN  = `in_${s.id}.${ext}`;
        let outN = `out_${s.id}.${fmt}`;
        await ff.writeFile(inN, await fetchFile(s.file));
        await ff.exec(['-i', inN, '-ss', s.start.toFixed(3), '-to', s.end.toFixed(3), '-c', 'copy', outN]);
        let data = await ff.readFile(outN);
        let blob = new Blob([data.buffer], { type: MIME[fmt] });
        Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: s.file.name.replace(/\.[^.]+$/, '') + '_snippet.' + fmt,
        }).click();
        await ff.deleteFile(inN); await ff.deleteFile(outN);
      }
    } else {
      // slice each → concat → output
      let slices = [];
      for (let s of list) {
        let ext    = s.file.name.split('.').pop();
        let inN    = `in_${s.id}.${ext}`;
        let sliceN = `slice_${s.id}.${fmt}`;
        await ff.writeFile(inN, await fetchFile(s.file));
        await ff.exec(['-i', inN, '-ss', s.start.toFixed(3), '-to', s.end.toFixed(3), sliceN]);
        slices.push(sliceN);
        await ff.deleteFile(inN);
      }
      await ff.writeFile('list.txt', slices.map(f => `file '${f}'`).join('\n'));
      await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', `out.${fmt}`]);
      let data = await ff.readFile(`out.${fmt}`);
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([data.buffer], { type: MIME[fmt] })),
        download: `combined.${fmt}`,
      }).click();
      for (let f of slices) await ff.deleteFile(f);
      await ff.deleteFile('list.txt'); await ff.deleteFile(`out.${fmt}`);
    }
  } catch(e) { console.error(e); }
  exporting.value = false;
}

// ── SnippetPane ───────────────────────────────────────────────────────────────
function SnippetPane({ snippet, index, total }) {
  let { id, file, start, end, duration, playing } = snippet;
  
  let moveUp   = () => moveSnippet(id, -1);
  let moveDown = () => moveSnippet(id,  1);
  let remove   = () => { stopSnippet(id); snippets.value = snippets.value.filter(s => s.id !== id); }
  
  let handleWaveformChange = (type, time) => {
    (type === 'start')
    ? update(snippet.id, { start: Math.min(time,   snippet.end - 0.1) })
    : update(snippet.id, {   end: Math.max(time, snippet.start + 0.1) });
  };
  
  return html`
    <div class="snippet-pane">
      
      <div class="pane-header">
        <${Icon} name="mdi:music-note-outline" />
        <span class="pane-title">${file.name}</span>
        <span class="sel-dur">${fmtT(end - start)}</span>
        <div class="pane-controls">
          <${GhostButton} icon='mdi:chevron-up'   onClick=${moveUp}   disabled=${index === 0}         />
          <${GhostButton} icon='mdi:chevron-down' onClick=${moveDown} disabled=${index === total - 1} />
          <${GhostButton} icon='mdi:close'        onClick=${remove}   />
        </div>
      </div>
      
      <${WaveformWithHandles} 
        peaks=${snippet.peaks}
        start=${snippet.start}
        end=${snippet.end}
        duration=${snippet.duration}
        playPos=${snippet.playPos}
        onChange=${handleWaveformChange}
      />
      
      <div class="pane-footer">
        <button class="btn icon-only" onClick=${() => toggleSnippet(id)} title=${playing ? 'Pause' : 'Play selection'}>
          <${Icon} name=${playing ? 'mdi:pause' : 'mdi:play'} />
        </button>
        <div class="time-row">
          <label>Start</label>
          <input type="number" class="field time-input" step="0.1" min="0" max=${(end-.1).toFixed(1)}
            value=${start.toFixed(1)}
            onInput=${e => update(id, { start: clamp(+e.target.value, 0, end-.1) })} />
          <${Icon} name="mdi:arrow-right" />
          <label>End</label>
          <input type="number" class="field time-input" step="0.1" min=${(start+.1).toFixed(1)} max=${duration.toFixed(1)}
            value=${end.toFixed(1)}
            onInput=${e => update(id, { end: clamp(+e.target.value, start+.1, duration) })} />
          <span class="total-dur">/ ${fmtT(duration)}</span>
        </div>
      </div>
      
    </div>`;
}


// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  let list     = snippets.value;
  let hasList  = list.length > 0;
  let busy     = exporting.value || ffLoading.value;
  let isPrev   = previewing.value;
  let totalDur = list.reduce((a, s) => a + (s.end - s.start), 0);

  return html`
    <div id="app-body">
      <${Dropzone} accept='audio/*' multiple=${true} what='audio files' onFiles=${entries => entries.forEach(entry => loadFile(entry.file))} />
      
      ${hasList && html`
        <div class="snippets">
          ${list.map((s, i) => html`
            <${SnippetPane} key=${s.id} snippet=${s} index=${i} total=${list.length} />`)}
        </div>
        
        <div class="preview-bar">
          <button class=${'btn ' + (isPrev ? 'secondary' : 'primary')}
            onClick=${isPrev ? stopPreview : () => playPreview(0)}>
            <${Icon} name=${isPrev ? 'mdi:stop' : 'mdi:play-circle-outline'} />
            ${isPrev ? 'Stop preview' : 'Preview all'}
          </button>
          <span class="preview-info">
            ${list.length} snippet${list.length > 1 ? 's' : ''} · ${fmtT(totalDur)} total
          </span>
        </div>
        
        <div class="export-bar">
          <${Picker} options=${FORMATS} value=${format.value} onChange=${f => format.value = f} />
          <div class="export-btns">
            <button class="btn primary" onClick=${() => doExport('combined')} disabled=${busy}>
              <${Icon} name=${busy ? 'mdi:loading' : 'mdi:download'} class=${busy ? 'spin' : ''} />
              ${ffLoading.value ? 'Loading ffmpeg…' : 'Export combined'}
            </button>
            <button class="btn secondary" onClick=${() => doExport('individual')} disabled=${busy}>
              <${Icon} name="mdi:download-multiple" /> Export individually
            </button>
          </div>
        </div>
      `}
    </div>`;
}

boot({ config, App });
