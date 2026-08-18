// tools/audio-converter/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';
import { fetchFile } from '@ffmpeg/util';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { loadFFmpeg } from './../../shared/js/lib/ffmpeg.js';
import { Dropzone, Icon, Picker } from './../../shared/js/components/index.js';

// ::: local
import * as config from './app.config.js';

// ── state ─────────────────────────────────────────────────────────────────────
let files     = signal([]);
let format    = signal('mp3');
let ffReady   = signal(false);   // ffmpeg loaded?
let ffLoading = signal(false);
let FORMATS   = ['flac', 'm4a', 'mp3', 'ogg', 'wav'];
let MIME      = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4' };
let _id = 0;
let ff;

// ── ffmpeg lazy init ──────────────────────────────────────────────────────────
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

// ── helpers ───────────────────────────────────────────────────────────────────
let update = (id, patch) => files.value = files.value.map(f => f.id === id ? { ...f, ...patch } : f);

let addFiles = list => {
  files.value = [
    ...files.value,
    ...[...list].map(file => ({ id: _id++, file, status: 'pending', progress: 0, blobUrl: null, outName: null, error: null }))
  ];
};

async function convertOne (entry) {
  update(entry.id, { status: 'converting', progress: 0 });
  try {
    let fmt = format.value;
    let inName  = 'in_'  + entry.id;
    let outName = 'out_' + entry.id + '.' + fmt;

    ff.on('progress', ({ progress }) =>
      update(entry.id, { progress: Math.round(progress * 100) })
    );

    await ff.writeFile(inName, await fetchFile(entry.file));
    await ff.exec(['-i', inName, outName]);

    let data    = await ff.readFile(outName);
    let blob    = new Blob([data.buffer], { type: MIME[fmt] });
    let blobUrl = URL.createObjectURL(blob);
    let name    = entry.file.name.replace(/\.[^.]+$/, '') + '.' + fmt;

    await ff.deleteFile(inName);
    await ff.deleteFile(outName);

    update(entry.id, { status: 'done', blobUrl, outName: name, progress: 100 });
  } catch(e) {
    update(entry.id, { status: 'error', error: e.message });
  }
}

async function convertAll() {
  await ensureFF();
  // sequential — ffmpeg.wasm isn't thread-safe across concurrent execs
  for (let f of files.value.filter(f => f.status === 'pending')) {
    await convertOne(f);
  }
}

let downloadAll = () =>
  files.value.filter(f => f.status === 'done').forEach(f =>
    Object.assign(document.createElement('a'), { href: f.blobUrl, download: f.outName }).click()
  );


function FormatPicker() {
  return html`
    <${Picker} options=${FORMATS} value=${format.value} onChange=${f => format.value = f} />`;
}

function FileItem({ entry: e }) {
  let icon = { pending: 'mdi:music-note-outline', converting: 'mdi:loading', done: 'mdi:check-circle-outline', error: 'mdi:alert-circle-outline' }[e.status];
  return html`
    <div class=${'file-item ' + e.status}>
      <${Icon} name=${icon} className=${e.status === 'converting' ? 'spin' : ''} />
      <span class="name">${e.file.name}</span>
      <span class="label">
        ${e.status === 'pending'    ? '—'
        : e.status === 'converting' ? e.progress + '%'
        : e.status === 'done'       ? e.outName
        :                             e.error}
      </span>
      ${e.status === 'converting' && html`
        <div class="progress-bar"><div style=${'width:' + e.progress + '%'} /></div>`}
      ${e.status === 'done' && html`
        <a class="icon-btn" href=${e.blobUrl} download=${e.outName} title="Download">
          <${Icon} name="mdi:download" />
        </a>`}
      ${e.status !== 'converting' && html`
        <button class="icon-btn remove" onClick=${() => files.value = files.value.filter(f => f.id !== e.id)}>
          <${Icon} name="mdi:close" />
        </button>`}
    </div>`;
}

function App() {
  let list       = files.value;
  let pendingCnt = list.filter(f => f.status === 'pending').length;
  let hasDone    = list.some(f => f.status === 'done');

  return html`
    <div id="app-body">
      <${Dropzone} accept='audio/*' multiple=${true} what='audio files' onFiles=${entries => addFiles(entries.map(entry => entry.file))} />
      ${list.length > 0 && html`
        <${FormatPicker} />
        <div class="file-list">${list.map(e => html`<${FileItem} key=${e.id} entry=${e} />`)}</div>
        <div class="actions">
          ${pendingCnt > 0 && html`
            <button class="btn primary" onClick=${convertAll} disabled=${ffLoading.value}>
              <${Icon} name=${ffLoading.value ? 'mdi:loading' : 'mdi:cog-outline'}
                            className=${ffLoading.value ? 'spin' : ''} />
              ${ffLoading.value ? 'Loading ffmpeg…' : 'Convert ' + pendingCnt + ' file' + (pendingCnt > 1 ? 's' : '')}
            </button>`}
          ${hasDone && html`
            <button class="btn secondary" onClick=${downloadAll}>
              <${Icon} name="mdi:download-multiple-outline" /> Download all
            </button>`}
        </div>`}
    </div>`;
}

boot({ config, App });
