// shared/js/lib/signals.js
//
// `stored` is the replacement for the old signalWithStorage() from preact-x:
// a signal that hydrates from localStorage and writes every change back.
//
//   const format = stored('webp', 'image-converter:format');

import aufbau from '@aufbau/kits/preact-htm';
import { local, session } from '@aufbau/js/preact/x.js';

export const stored = (value, key, store = local) => aufbau.signal({ value, key, store });

export const storedIn = store => (value, key) => stored(value, key, store);

export { local, session };
