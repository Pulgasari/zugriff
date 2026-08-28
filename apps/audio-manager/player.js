// apps/audio-manager/player.js
//
// one <audio> element for the whole app, outside the component tree so it keeps
// playing across view changes. it plays a queue (a list of track records) and
// streams each file straight off disk via an object url. state is mirrored into
// signals the ui binds to.

import { signal } from '@aufbau/kits/preact-htm';
import { stored } from '/.shared/js/lib/signals.js';
import { fileAt } from './db.js';

const audio = new Audio;
audio.preload = 'metadata';

export const
current  = signal(null),     // the track record being played
playing  = signal(false),
waiting  = signal(false),
time     = signal(0),
duration = signal(0),
error    = signal('');

export const volume  = stored(1, 'audio:volume');
export const shuffle = stored(false, 'audio:shuffle');
export const repeat  = stored('off', 'audio:repeat');   // off | all | one

audio.volume = volume.value;

let queue = [];   // track records
let order = [];   // indices into queue, shuffled or sequential
let pos   = -1;   // position within order
let url    = null;

const revoke = () => { if (url) { URL.revokeObjectURL(url); url = null; } };

function buildOrder (startKey) {
  order = queue.map((_, i) => i);
  if (shuffle.value) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const k  = queue.findIndex(t => t.key === startKey);
    const oi = order.indexOf(k);
    if (oi > 0) order.unshift(...order.splice(oi, 1));
  }
  pos = Math.max(0, order.findIndex(i => queue[i].key === startKey));
}

async function load (track) {
  revoke();
  current.value  = track;
  time.value     = 0;
  duration.value = track.duration || 0;
  error.value    = '';
  waiting.value  = true;
  try {
    url = URL.createObjectURL(await fileAt(track));
    audio.src = url;
    audio.volume = volume.value;
    await audio.play().catch(() => {});
  } catch {
    error.value = 'could not read this file from disk';
    waiting.value = false;
  }
}

/** play `track` within the context of `list` (the queue) */
export function play (track, list) {
  if (!list && current.value?.key === track?.key) { toggle(); return; }
  queue = (list || [track]).slice();
  buildOrder((track || queue[0])?.key);
  if (pos >= 0 && queue.length) load(queue[order[pos]]);
}

export function toggle () {
  if (!current.value) return;
  audio.paused ? audio.play().catch(() => {}) : audio.pause();
}
export const pause = () => audio.pause();

export function next (auto = false) {
  if (!queue.length) return;
  if (auto && repeat.value === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (pos + 1 < order.length)         { pos++; load(queue[order[pos]]); }
  else if (repeat.value === 'all')    { pos = 0; load(queue[order[pos]]); }
  else audio.pause();
}

export function prev () {
  if (!queue.length) return;
  if (audio.currentTime > 3 || pos <= 0) { audio.currentTime = 0; return; }
  pos--; load(queue[order[pos]]);
}

export function seek (seconds) {
  audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  time.value = audio.currentTime;
}

export function setVolume (v) { volume.value = v; audio.volume = v; }
export function toggleShuffle () { shuffle.value = !shuffle.value; if (current.value) buildOrder(current.value.key); }
export function cycleRepeat () { repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off'; }

audio.addEventListener('loadedmetadata', () => { duration.value = audio.duration || duration.value; });
audio.addEventListener('timeupdate', () => { time.value = audio.currentTime; });
audio.addEventListener('play',    () => { playing.value = true; error.value = ''; });
audio.addEventListener('pause',   () => { playing.value = false; });
audio.addEventListener('waiting', () => { waiting.value = true; });
audio.addEventListener('playing', () => { waiting.value = false; });
audio.addEventListener('ended',   () => next(true));
audio.addEventListener('error',   () => { if (audio.src) { waiting.value = false; playing.value = false; } });
