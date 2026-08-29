// apps/podcasts/player.js

import { signal } from '@aufbau/kits/preact-htm';
import { stored } from '/.shared/js/lib/signals.js';

import { stateOf, setProgress, markDone } from './db.js';

const audio = new Audio();
audio.preload = 'metadata';

// ── signals the ui binds to ──────────────────────────────────────────────

export const current = signal(null);      // the episode record being played
export const playing = signal(false);
export const waiting = signal(false);      // buffering
export const time    = signal(0);          // current position, seconds
export const duration = signal(0);         // seconds (from metadata or the feed)
export const error   = signal('');

export const rate = stored(1, 'podcasts:rate');
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
export function play (ep) {
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

export function toggle () {
  if (!current.value) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

export const pause = () => audio.pause();

export function seek (seconds) {
  if (!current.value) return;
  audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  time.value = audio.currentTime;
  save(true);
}

export const skip = delta => seek((audio.currentTime || 0) + delta);

export function setRate (value) {
  rate.value = value;
  audio.playbackRate = value;
}

// leaving the page: flush the last position so nothing is lost
addEventListener('pagehide', () => save(true));
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
