// .shared/js/app/signals.js
// `stored` — a persisted signal, the drop-in for the old lib/signals.js helper,
// built on typedSignal (hydration + write-back per key). the value is held as it
// is given, like before. the storage defaults to localStorage, pass 'session'
// (or any storage typedSignal takes) to change it.
//
//   const format = stored('webp', 'image-converter:format');

import { typedSignal } from '@aufbau/signals';

export const stored = (value, key, storage = 'local') => typedSignal({ type: 'scalar', value, key, storage });

