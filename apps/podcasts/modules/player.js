// apps/podcasts/modules/player.js
// one <audio> element lifted out of the component tree so playback survives navigation.
// its state lives in preact signals internally; the public surface (app.player) is a
// `.value`-free facade of getters + methods, so the ui reads app.player.isPlaying /
// app.player.episode / app.player.time rather than a raw signal. reads inside render
// stay reactive (the getter reads the signal during render, so it subscribes).

import { signal } from '@preact/signals';
import { stored } from '/.shared/js/app/signals.js';

import { stateOf, setProgress, markDone } from './db.js';

const audio = new Audio();
audio.preload = 'metadata';

// ── internal signals ─────────────────────────────────────────────────────────

const current  = signal(null);   // the episode record being played, or null
const playing  = signal(false);
const waiting  = signal(false);   // buffering
const time     = signal(0);       // current position, seconds
const duration = signal(0);       // seconds (from metadata or the feed)
const error    = signal('');

const rate = stored(1, 'podcasts:rate');
audio.playbackRate = rate.value;

const DONE_AT = 0.95;      // fraction played that counts as finished
let   lastSaved = 0;       // throttle db writes
let   pendingSeek = null;  // position to jump to once metadata is in

// ── persistence ────────────────────────────────────────────────────────────

function save (force = false) {
  const ep = current.value;
  if (!ep) return;
  const now = Date.now();
  if (!force && now - lastSaved < 5000) return;
  lastSaved = now;
  setProgress(ep.id, audio.currentTime || 0, audio.duration || duration.value || 0);
}

function finish () {
  const ep = current.value;
  if (ep) markDone(ep.id, true);
}

// ── audio events ───────────────────────────────────────────────────────────

audio.addEventListener('loadedmetadata', () => {
  duration.value = audio.duration || duration.value;
  if (pendingSeek != null && Number.isFinite(audio.duration)) {
    if (pendingSeek < audio.duration - 5) audio.currentTime = pendingSeek;
    pendingSeek = null;
  }
});

audio.addEventListener('timeupdate', () => {
  time.value = audio.currentTime;
  const ep = current.value;
  if (ep && audio.duration && audio.currentTime / audio.duration >= DONE_AT) {
    if (!stateOf(ep.id).done) finish();
  }
  save();
});

audio.addEventListener('play',    () => { playing.value = true;  error.value = ''; });
audio.addEventListener('pause',   () => { playing.value = false; save(true); });
audio.addEventListener('waiting', () => { waiting.value = true; });
audio.addEventListener('playing', () => { waiting.value = false; });
audio.addEventListener('ended',   () => { playing.value = false; finish(); save(true); });
audio.addEventListener('error',   () => {
  if (!audio.src) return;
  waiting.value = false; playing.value = false;
  error.value = 'could not play this episode — the audio may be unavailable or blocked.';
});

// ── controls ─────────────────────────────────────────────────────────────

/** play an episode from its saved position (or toggle if it is already loaded) */
function play (ep) {
  if (current.value?.id === ep.id) { toggle(); return; }

  save(true);                       // flush the outgoing episode
  current.value  = ep;
  duration.value = ep.duration || 0;
  time.value     = 0;
  error.value    = '';
  waiting.value  = true;

  const st = stateOf(ep.id);
  pendingSeek = st.done ? 0 : (st.position || 0);

  audio.src = ep.audioUrl;
  audio.playbackRate = rate.value;
  audio.play().catch(() => { /* the error event reports it */ });
}

function toggle () {
  if (!current.value) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

const pause = () => audio.pause();

/** stop and drop the current episode (closes the player bar) */
function close () {
  audio.pause();
  current.value = null;
}

function seek (seconds) {
  if (!current.value) return;
  audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  time.value = audio.currentTime;
  save(true);
}

const skip = delta => seek((audio.currentTime || 0) + delta);

function setRate (value) {
  rate.value = value;
  audio.playbackRate = value;
}

// leaving the page: flush the last position so nothing is lost
addEventListener('pagehide', () => save(true));
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });

// ── public facade (app.player) — no `.value` at call sites ────────────────────
// getters read the internal signals, so a read inside render still subscribes.
// status collapses the flags to one enum; the isX booleans are the same, read nicely.

const player = {
  // reactive state
  get episode ()   { return current.value; },
  get time ()      { return time.value; },
  get duration ()  { return duration.value; },
  get rate ()      { return rate.value; },
  get error ()     { return error.value; },
  get isPlaying () { return playing.value; },
  get isWaiting () { return waiting.value; },
  get isError ()   { return !!error.value; },
  // 'idle' | 'waiting' | 'playing' | 'paused' | 'error' (waiting/error take priority)
  get status () {
    if (error.value)   return 'error';
    if (waiting.value) return 'waiting';
    if (playing.value) return 'playing';
    return current.value ? 'paused' : 'idle';
  },

  // controls
  play, toggle, pause, close, seek, skip, setRate,
};

export default player;
export { player };
