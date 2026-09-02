// .shared/js/app/signals.js
// `stored` — a persisted signal, the drop-in for the old lib/signals.js helper,
// now built on @aufbau/signals' factory (hydration + write-back per key). the
// store defaults to localStorage; pass session (or cookie) to change it.
//
//   const format = stored('webp', 'image-converter:format');

import { signal, local, session } from '@aufbau/signals';

export const stored   = (value, key, store = local) => signal({ value, key, store });
export const storedIn = store => (value, key) => stored(value, key, store);

export { local, session };
