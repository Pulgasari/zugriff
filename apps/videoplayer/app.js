// apps/videoplayer/app.js

// :::::: IMPORT

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config }                 from '/.shared/js/app.js?slug=videoplayer';
import { Icon, Taplet, SettingsGroups } from '/.shared/js/components/index.js';
import { appGroup }                     from '/.shared/js/lib/settings.js';

// :::::: STATE

const
src      = signal(null),      // object url of the loaded file, or null
title    = signal(''),        // the file name, shown in the topbar
duration = signal(0),
current  = signal(0),
playing  = signal(false),

// transforms
loop     = signal(false),
reversed = signal(false),     // play backwards (driven by rAF — see below)
fit      = signal('contain'), // 'contain' | 'cover' — crop toggles this
aspect   = signal(null),      // null = native, else a css aspect-ratio string
flipped  = signal(false),     // mirror (scaleX)
rotation = signal(0),         // 0 | 90 | 180 | 270

// chrome
chromeHidden = signal(false), // double-tap kills the bars
settingsOpen = signal(false); // stub for now — the panel is only prepared

// the aspect ratios the button cycles through, native first
const ASPECTS = [null, '9 / 16', '16 / 9', '1 / 1', '4 / 3'];
const FPS_GUESS = 30;   // frame stepping has no real fps from <video>; assume 30

// :::::: PLAYBACK

// a single <video>, kept for the app's lifetime. imperative control (play,
// seek, step) reads it straight off this ref rather than through the signals.
// a stable ref callback (not an inline arrow) so preact binds it once, not on
// every render.
const videoRef = { current: null };
const setVideoEl = el => { videoRef.current = el; };

const clamp = t => Math.min(duration.value || 0, Math.max(0, t));
const fmt = t => {
  if (!isFinite(t)) return '0:00';
  const s = Math.floor(t % 60), m = Math.floor(t / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── reverse ────────────────────────────────────────────────────────────────
// <video> has no reliable backwards playback (a negative playbackRate throws or
// is ignored), so reverse is a rAF loop that walks currentTime down in real
// time. it is best-effort — the browser only shows the keyframes it can seek to
// — but it reads as reverse.
let rafId = 0, lastTs = 0;

function reverseTick (ts) {
  const v = videoRef.current;
  if (!v || !playing.value || !reversed.value) { rafId = 0; return; }
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;

  let t = v.currentTime - dt;
  if (t <= 0) {
    if (loop.value) { t = v.duration; }
    else { v.currentTime = 0; current.value = 0; pause(); return; }
  }
  v.currentTime = t;
  current.value = t;
  rafId = requestAnimationFrame(reverseTick);
}

function drive () {
  const v = videoRef.current;
  if (!v) return;
  cancelAnimationFrame(rafId); rafId = 0;
  if (reversed.value) { v.pause(); lastTs = 0; rafId = requestAnimationFrame(reverseTick); }
  else { v.play().catch(err => console.warn('[videoplayer] play() rejected:', err)); }
}

function play () {
  if (!src.value) return;
  playing.value = true;
  drive();
}

function pause () {
  const v = videoRef.current;
  playing.value = false;
  cancelAnimationFrame(rafId); rafId = 0;
  v?.pause();
}

const togglePlay = () => (playing.value ? pause() : play());

function seek (t) {
  const v = videoRef.current;
  if (!v) return;
  v.currentTime = clamp(t);
  current.value = v.currentTime;
}

const skip = sec => seek((videoRef.current?.currentTime ?? 0) + sec);

// step one frame; only meaningful while paused, so pause first
function stepFrame (dir) {
  pause();
  seek((videoRef.current?.currentTime ?? 0) + dir / FPS_GUESS);
}

function toggleReverse () {
  reversed.value = !reversed.value;
  if (playing.value) drive();   // switch the drive under a running clip
}

function toggleLoop () {
  loop.value = !loop.value;
  const v = videoRef.current;
  if (v) v.loop = loop.value;   // forward loop is native; reverse loop is in the tick
}

const cycleAspect = () => {
  const i = ASPECTS.indexOf(aspect.value);
  aspect.value = ASPECTS[(i + 1) % ASPECTS.length];
};
const toggleCrop = () => fit.value = fit.value === 'cover' ? 'contain' : 'cover';
const toggleFlip = () => flipped.value = !flipped.value;
const rotate     = () => rotation.value = (rotation.value + 90) % 360;

// ── file open ────────────────────────────────────────────────────────────────
// the codebase opens files with a hidden <input type=file>, not the File System
// Access picker — it is the mobile-friendly path and works everywhere. this
// hands us a File; we play it from a local object url and never touch the disk
// again.
function loadFile (file) {
  if (!file) return;
  const v = videoRef.current;
  pause();                                          // stop any playback / rAF loop
  if (src.value) URL.revokeObjectURL(src.value);    // free the previous clip
  const url = URL.createObjectURL(file);
  src.value      = url;
  title.value    = file.name;
  duration.value = 0;
  current.value  = 0;
  reversed.value = false;
  playing.value  = false;

  // drive the media element imperatively — the same pattern podcasts uses for
  // its <audio>. binding a media element's src reactively (and rendering an
  // empty src="" while no file is loaded) pushes it into an error state it does
  // not always recover from; setting src here and calling load() is reliable.
  if (v) { v.src = url; v.load(); }
}

// :::::: TRANSFORM STYLE :::::::::::::::::::::::::::::::::::

// the css transform for the <video>: rotate then mirror. kept as one string so
// the two never clobber each other.
const videoTransform = computed(() => {
  const parts = [];
  if (rotation.value) parts.push(`rotate(${rotation.value}deg)`);
  if (flipped.value)  parts.push('scaleX(-1)');
  return parts.join(' ') || 'none';
});

// :::::: COMPONENTS

/*
function Taplet ({ icon, size, title, onClick }) {
  return html`
    <button class="taplet" title=${title} onClick=${onClick}>
      <${Icon} name=${icon} size=${size} />
    </button>
  `;
}
*/

const setBoolSignal = (signal, value) => { if (typeof signal !== 'undefined') signal.value = Boolean(value); };

function SettingsTaplet () {
  return html`<${Taplet} icon='settings' title='Settings' onClick=${() => settingsOpen.value = true} />`;    
}



function TopBar () {
  return html`
    <header class="topbar">
      <span class="title">${title.value || config.name}</span>
      <span class="spacer"></span>
      <${SettingsTaplet} />
    </header>`;
}

// one transport / transform button
function Ctrl ({ icon, label, onClick, active = false, big = false, disabled = false }) {
  return html`
    <button
      class=${['ctrl', big && 'big', active && 'active'].filter(Boolean).join(' ')}
      title=${label}
      aria-label=${label}
      disabled=${disabled}
      onClick=${onClick}>
      <${Icon} name=${icon} size=${big ? 30 : 22} />
    </button>`;
}

function Progress () {
  return html`
    <div class="progress">
      <span class="time">${fmt(current.value)}</span>
      <input
        class="scrub"
        type="range"
        min="0"
        max=${duration.value || 0}
        step="0.01"
        value=${current.value}
        disabled=${!src.value}
        onInput=${e => seek(parseFloat(e.target.value))} />
      <span class="time">${fmt(duration.value)}</span>
    </div>`;
}

function Controls () {
  const disabled = !src.value;
  return html`
    <div class="controls">

      <div class="row transport">
        <${Ctrl} icon="mdi:rewind-10"     label="Back 10s"    disabled=${disabled} onClick=${() => skip(-10)} />
        <${Ctrl} icon="mdi:step-backward" label="Frame back"  disabled=${disabled} onClick=${() => stepFrame(-1)} />
        <${Ctrl} icon=${playing.value ? 'mdi:pause' : 'mdi:play'} label=${playing.value ? 'Pause' : 'Play'}
                 big disabled=${disabled} onClick=${togglePlay} />
        <${Ctrl} icon="mdi:step-forward"  label="Frame forward" disabled=${disabled} onClick=${() => stepFrame(1)} />
        <${Ctrl} icon="mdi:fast-forward-10" label="Forward 10s" disabled=${disabled} onClick=${() => skip(10)} />
      </div>

      <${Progress} />

      <div class="row transforms">
        <${Ctrl} icon=${loop.value ? 'mdi:repeat' : 'mdi:repeat-off'} label="Loop"
                 active=${loop.value} disabled=${disabled} onClick=${toggleLoop} />
        <${Ctrl} icon="mdi:aspect-ratio" label="Aspect ratio"
                 active=${aspect.value != null} disabled=${disabled} onClick=${cycleAspect} />
        <${Ctrl} icon="mdi:crop" label="Crop to fill"
                 active=${fit.value === 'cover'} disabled=${disabled} onClick=${toggleCrop} />
        <${Ctrl} icon="mdi:rewind" label="Reverse"
                 active=${reversed.value} disabled=${disabled} onClick=${toggleReverse} />
        <${Ctrl} icon="mdi:flip-horizontal" label="Mirror"
                 active=${flipped.value} disabled=${disabled} onClick=${toggleFlip} />
        <${Ctrl} icon="mdi:rotate-right" label="Rotate"
                 active=${rotation.value !== 0} disabled=${disabled} onClick=${rotate} />
      </div>

    </div>`;
}

function SettingsPanel () {
  if (!settingsOpen.value) return null;
  return html`
    <div class="sheet-backdrop" onClick=${() => settingsOpen.value = false}>
      <aside class="sheet" onClick=${e => e.stopPropagation()}>
        <header class="sheet-head">
          <strong>Settings</strong>
          <button class="icon-btn" title="Close" onClick=${() => settingsOpen.value = false}>
            <${Icon} name="mdi:close" size="22" />
          </button>
        </header>
        <div class="sheet-body">
          <${SettingsGroups} groups=${[appGroup]} />
        </div>
      </aside>
    </div>`;
}

function Stage () {
  const fileInput = useRef(null);
  const pick = () => fileInput.current?.click();

  // double-tap toggles all chrome; a single tap is left alone so it can't fight
  // the transport buttons for a mistap
  const lastTap = useRef(0);
  const onTap = () => {
    if (!src.value) return;
    const now = Date.now();
    if (now - lastTap.current < 300) { chromeHidden.value = !chromeHidden.value; lastTap.current = 0; }
    else lastTap.current = now;
  };

  // bind the media events once the element is mounted
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { duration.value = v.duration || 0; };
    const onTime = () => { if (!reversed.value) current.value = v.currentTime; };
    const onEnd  = () => { if (!loop.value) playing.value = false; };
    const onErr  = () => { console.warn('[videoplayer] media error:', v.error); playing.value = false; };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    v.addEventListener('error', onErr);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('error', onErr);
    };
  }, []);

  return html`
    <div class="stage" onClick=${onTap}>
      <div class="frame" data-aspect=${aspect.value ? '' : null}
           style=${aspect.value ? `--aspect:${aspect.value}` : ''}>
        <video
          ref=${setVideoEl}
          class="video"
          playsinline
          loop=${loop.value}
          style=${`--fit:${fit.value}; transform:${videoTransform.value}`}></video>
      </div>

      ${!src.value && html`
        <button class="empty" onClick=${pick}>
          <${Icon} name="mdi:movie-open-outline" size="48" />
          <span>Open a video</span>
          <small>It stays on your device.</small>
        </button>`}

      <input ref=${fileInput} type="file" accept="video/*" hidden
             onChange=${e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
    </div>`;
}

function App () {
  return html`
    <div class=${['player', chromeHidden.value && 'chrome-off'].filter(Boolean).join(' ')}>
      <${TopBar} />
      <${Stage} />
      <${Controls} />
      <${SettingsPanel} />
    </div>`;
}

// :::::: BOOT

boot({ config, App });
