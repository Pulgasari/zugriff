// apps/podcasts/modules/player.js

import { signal } from '@aufbau/signals';
import { stateOf, setProgress, markDone } from './db.js';

const audio = new Audio;
audio.preload = 'metadata';

// ── internal signals ─────────────────────────────────────────────────────────

const state = signal({
  duration  : 0,     // seconds (from metadata or the feed)
  episode   : null,  // the episode record being played, or null
  error     : '',
  rate      : 1,
  time      : 0,     // current position, seconds

  
  isError   : false,
  isPlaying : false,
  isWaiting : false, // buffering
});


audio.playbackRate = state.rate;

const DONE_AT     = 0.95;  // fraction played that counts as finished
let   lastSaved   = 0;     // throttle db writes
let   pendingSeek = null;  // position to jump to once metadata is in

// ── persistence ────────────────────────────────────────────────────────────

function save (force = false) {
  const ep = state.episode;
  if (!ep) return;
  const now = Date.now();
  if (!force && now - lastSaved < 5000) return;
  lastSaved = now;
  setProgress(ep.id, audio.currentTime || 0, audio.duration || state.duration || 0);
}

function finish () {
  const ep = state.episode;
  if (ep) markDone(ep.id, true);
}

// ── audio events ───────────────────────────────────────────────────────────

audio.addEventListener('loadedmetadata', () => {
  state.duration = audio.duration || state.duration;
  if (pendingSeek != null && Number.isFinite(audio.duration)) {
    if (pendingSeek < audio.duration - 5) audio.currentTime = pendingSeek;
    pendingSeek = null;
  }
});

audio.addEventListener('timeupdate', () => {
  state.time = audio.currentTime;
  const ep = state.episode;
  if (ep && audio.duration && audio.currentTime / audio.duration >= DONE_AT) {
    if (!stateOf(ep.id).done) finish();
  }
  save();
});

audio.addEventListener('play',    () => { state.isPlaying = true;  error.value = ''; });
audio.addEventListener('pause',   () => { state.isPlaying = false; save(true); });
audio.addEventListener('waiting', () => { state.isWaiting = true; });
audio.addEventListener('playing', () => { state.isWaiting = false; });
audio.addEventListener('ended',   () => { state.isPlaying = false; finish(); save(true); });
audio.addEventListener('error',   () => {
  if (!audio.src) return;
  state.isWaiting = false;
  state.isPlaying = false;
  state.error = 'could not play this episode — the audio may be unavailable or blocked.';
});

// ── controls ─────────────────────────────────────────────────────────────

/** play an episode from its saved position (or toggle if it is already loaded) */
function play (ep) {
  if (state.episode?.id === ep.id) { toggle(); return; }

  save(true);                       // flush the outgoing episode
  state.episode   = ep;
  state.duration  = ep.duration || 0;
  state.time      = 0;
  state.isError   = '';
  state.isWaiting = true;

  const st = stateOf(ep.id);
  pendingSeek = st.done ? 0 : (st.position || 0);

  audio.src          = ep.audioUrl;
  audio.playbackRate = state.rate;
  audio.play().catch(() => { /* the error event reports it */ });
}

function toggle () {
  if (!state.episode) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

const pause = () => audio.pause();

/** stop and drop the current episode (closes the player bar) */
function close () {
  audio.pause();
  state.episode = null;
}

function seek (seconds) {
  if (!state.episode) return;
  audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  state.time = audio.currentTime;
  save(true);
}

const skip = delta => seek((audio.currentTime || 0) + delta);

function setRate (value) {
  state.rate         = value;
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
  get episode   () { return   state.episode; },
  get time      () { return   state.time; },
  get duration  () { return   state.duration; },
  get rate      () { return   state.rate; },
  get error     () { return   state.error; },
  get isPlaying () { return   state.isPlaying; },
  get isWaiting () { return   state.isWaiting; },
  get isError   () { return !!state.isError; },
  // 'idle' | 'waiting' | 'playing' | 'paused' | 'error' (waiting/error take priority)
  get status () {
    if (state.isError)   return 'error';
    if (state.isWaiting) return 'waiting';
    if (state.isPlaying) return 'playing';
    return state.episode ? 'paused' : 'idle';
  },

  // controls
  play, toggle, pause, close, seek, skip, setRate,
};

export default player;
export { player };
