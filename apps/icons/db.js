// apps/icons/db.js
//
// on-device storage — one @bunker/db with two stores: `favs` (the icons the
// user hearted) and `cache` (the Iconify collection/set responses, see
// iconify.js). the whole app persists nothing else.

import { signal } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';

export const db = createDb('zugriff-icons');

let setup = null;
export const ready = () => (setup ??= db.setup({ favs: {}, cache: {} }));

// ── favourites ───────────────────────────────────────────────────────────

export const favs = signal(new Set());   // icon names, e.g. 'mdi:home'

export async function loadFavs () {
  await ready();
  favs.value = new Set(Object.keys(await db.getAll('favs')));
}

export const isFav = name => favs.value.has(name);

export async function toggleFav (name) {
  const set = new Set(favs.value);
  if (set.has(name)) { set.delete(name); await db.delete('favs', name); }
  else               { set.add(name);    await db.set('favs', name, 1); }
  favs.value = set;
}
