// apps/podcasts/modules/db.js
// storage layer. one @bunker/db (indexeddb) is the durable store; three reactive
// maps mirror it so the ui stays live without touching indexeddb. every write is
// write-through — it updates the map and the store together.
//
//   podcasts  id                   -> podcast record
//   episodes  `${podcastId}:${h}`  -> episode record   (prefix-scannable per podcast)
//   state     episodeId            -> { position, done, saved, ... }

import { computed, makeMap, signal } from '@aufbau/signals';
import { createDb }                  from '@bunker/db';
import { fetchFeed, parseFeed }      from './feed.js';

const db = createDb('zugriff-podcasts');

// ── ids ──
// cyrb53: a short, stable base-36 hash, so long urls/guids stay out of the keys.
// same input -> same id, which is what lets progress survive a re-fetch.

function hash (str = '') {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const
podcastId = url         => 'p' + hash(url),
episodeId = (pid, guid) => `${pid}:${hash(guid)}`;

// ── reactive mirror (the source the ui reads) ──

const podcastMap = makeMap();   // id        -> podcast
const episodeMap = makeMap();   // episodeId -> episode
const stateMap   = makeMap();   // episodeId -> state

export const ready = signal(false);

// public views derived from the maps, so consumers keep their array/lookup shape
export const podcasts    = computed(() => [...podcastMap.values()]);
export const episodes    = computed(() => [...episodeMap.values()]);
export const states      = computed(() => stateMap.toObject());
export const podcastById = computed(() => podcastMap.toObject());
export const episodeById = computed(() => episodeMap.toObject());

// episodes grouped by podcast, so a podcast view is a lookup instead of a filter
export const episodesByPodcast = computed(() => {
  const map = {};
  for (const ep of episodeMap.values()) (map[ep.podcastId] ??= []).push(ep);
  return map;
});

// every saved episode, newest-saved first, joined to its episode record
export const savedEpisodes = computed(() =>
  [...stateMap.entries()]
    .filter(([, s]) => s.saved)
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .map(([id]) => episodeMap.get(id))
    .filter(Boolean));

// merge entries into a map in one publish (per-key set would copy the map each time)
const merge = (map, entries) => map.replace([...map.entries(), ...entries]);

// ── loading ──

export async function load () {
  // create all three stores in ONE upgrade before reading them; otherwise the three
  // reads each trigger their own lazy upgrade and those cycles race on a cold db
  // ("upgrade blocked by another connection"). setup() is idempotent afterwards.
  await db.setup({ podcasts: {}, episodes: {}, state: {} });

  const [pods, eps, st] = await Promise.all([
    db.podcasts.getAll(),
    db.episodes.getAll(),
    db.state.getAll(),
  ]);
  podcastMap.replace(pods);
  episodeMap.replace(eps);
  stateMap.replace(st);
  ready.value = true;
}

// ── state (progress / done / saved) ──

const EMPTY_STATE = { position: 0, duration: 0, done: false, doneAt: 0, saved: false, savedAt: 0, updatedAt: 0 };

export const stateOf = id => stateMap.get(id) ?? EMPTY_STATE;

/** merge `patch` into an episode's state, persist it and refresh the mirror */
export async function patchState (id, patch) {
  const next = { ...EMPTY_STATE, ...stateMap.get(id), ...patch, updatedAt: Date.now() };
  stateMap.set(id, next);
  await db.state.set(id, next);
  return next;
}

export const setProgress = (id, position, duration) => patchState(id, { position, duration });
export const markDone     = (id, done = true)        => patchState(id, { done, doneAt: done ? Date.now() : 0 });
export const toggleDone   = id => markDone(id, !stateOf(id).done);
export const toggleSaved  = id => {
  const cur = stateOf(id);
  return patchState(id, { saved: !cur.saved, savedAt: !cur.saved ? Date.now() : 0 });
};

// ── subscriptions ──

/** turn a parsed feed into our records, keyed and hashed */
function toRecords (url, parsed) {
  const pid = podcastId(url);

  const eps = parsed.episodes.map(ep => {
    const guid = ep.guid || ep.audioUrl || ep.link || ep.title;
    return {
      id          : episodeId(pid, guid),
      podcastId   : pid,
      guid,
      title       : ep.title,
      description : ep.description,
      audioUrl    : ep.audioUrl,
      audioType   : ep.audioType,
      pubDate     : ep.pubDate,
      duration    : ep.duration,
      image       : ep.image,
      link        : ep.link,
    };
  }).filter(ep => ep.audioUrl);       // an episode with no audio is nothing to play

  const podcast = {
    id           : pid,
    url,
    title        : parsed.title || url,
    description  : parsed.description,
    author       : parsed.author,
    image        : parsed.image,
    link         : parsed.link,
    addedAt      : Date.now(),
    lastFetched  : Date.now(),
    lastEpisodeAt: eps.reduce((max, ep) => Math.max(max, ep.pubDate || 0), 0),
    episodeCount : eps.length,
  };

  return { podcast, eps };
}

/** batch-write episodes in one transaction */
const writeEpisodes = eps =>
  eps.length && db.task('episodes', 'readwrite', store => { for (const ep of eps) store.put(ep, ep.id); });

/**
 * subscribe to a feed by url. fetches, parses and stores it. throws on a bad feed
 * or an unreachable url so the caller can surface the message.
 */
export async function subscribe (rawUrl, proxy) {
  const url = normalizeUrl(rawUrl);
  const pid = podcastId(url);
  if (podcastMap.has(pid)) throw new Error('already subscribed to this feed');

  const parsed = parseFeed(await fetchFeed(url, proxy));
  if (!parsed.episodes.length) throw new Error('no episodes found in this feed');

  const { podcast, eps } = toRecords(url, parsed);

  await db.podcasts.set(pid, podcast);
  await writeEpisodes(eps);

  podcastMap.set(pid, podcast);
  merge(episodeMap, eps.map(ep => [ep.id, ep]));
  return podcast;
}

/** re-fetch one subscription and merge in any new episodes */
export async function refresh (pid, proxy) {
  const podcast = podcastMap.get(pid);
  if (!podcast) return;

  const parsed = parseFeed(await fetchFeed(podcast.url, proxy));
  const { podcast: fresh, eps } = toRecords(podcast.url, parsed);

  const prefix = pid + ':';
  const known  = new Set([...episodeMap.keys()].filter(k => k.startsWith(prefix)));
  const added  = eps.filter(ep => !known.has(ep.id)).length;

  // rewrite every episode (metadata may have changed) but keep the podcast's addedAt
  await writeEpisodes(eps);
  const merged = { ...podcast, ...fresh, addedAt: podcast.addedAt, lastFetched: Date.now() };
  await db.podcasts.set(pid, merged);

  const others = [...episodeMap.entries()].filter(([k]) => !k.startsWith(prefix));
  episodeMap.replace([...others, ...eps.map(ep => [ep.id, ep])]);
  podcastMap.set(pid, merged);
  return { added };
}

export async function refreshAll (proxy, onProgress) {
  const all = [...podcastMap.values()];
  const results = [];
  let done = 0;
  for (const p of all) {
    try { results.push(await refresh(p.id, proxy)); }
    catch (err) { results.push({ error: err?.message || String(err), podcast: p }); }
    onProgress?.(++done, all.length);
  }
  return results;
}

/** drop a subscription along with its episodes and their state */
export async function unsubscribe (pid) {
  const prefix = pid + ':';
  const keys   = await db.episodes.keys(prefix);   // every stored episode of this podcast

  await db.podcasts.delete(pid);
  await db.task('episodes', 'readwrite', store => { for (const id of keys) store.delete(id); });
  await db.task('state',    'readwrite', store => { for (const id of keys) store.delete(id); });

  podcastMap.delete(pid);
  episodeMap.replace([...episodeMap.entries()].filter(([k]) => !k.startsWith(prefix)));
  stateMap.replace([...stateMap.entries()].filter(([k]) => !k.startsWith(prefix)));
}

// ── import / export ──
// state is keyed by feed url + episode guid so it re-attaches after an import
// re-fetches the feeds — the ids are derived from exactly those two strings.

const stateKey = (url, guid) => `${url}\n${guid}`;

export function exportData () {
  const state = {};
  for (const [id, s] of stateMap.entries()) {
    if (!s.saved && !s.done && !s.position) continue;   // nothing worth keeping
    const ep      = episodeMap.get(id);
    const podcast = ep && podcastMap.get(ep.podcastId);
    if (!podcast) continue;
    state[stateKey(podcast.url, ep.guid)] = {
      position: s.position, duration: s.duration,
      done: s.done, doneAt: s.doneAt, saved: s.saved, savedAt: s.savedAt,
    };
  }

  return {
    app        : 'zugriff-podcasts',
    version    : 1,
    exportedAt : new Date().toISOString(),
    feeds      : [...podcastMap.values()].map(p => ({ url: p.url, title: p.title })),
    state,
  };
}

export async function importData (data, proxy, onProgress) {
  if (!data || !Array.isArray(data.feeds)) throw new Error('not a podcasts export file');

  const results = [];
  let done = 0;
  for (const feed of data.feeds) {
    const url = normalizeUrl(feed.url || '');
    if (!url)                          results.push({ url: feed.url, skipped: 'no url' });
    else if (podcastMap.has(podcastId(url))) results.push({ url, skipped: 'already subscribed' });
    else {
      try { await subscribe(url, proxy); results.push({ url, added: true }); }
      catch (err) { results.push({ url, error: err?.message || String(err) }); }
    }
    onProgress?.(++done, data.feeds.length);
  }

  // re-apply saved state now that the episodes exist
  if (data.state) {
    const idByKey = {};
    for (const ep of episodeMap.values()) {
      const podcast = podcastMap.get(ep.podcastId);
      if (podcast) idByKey[stateKey(podcast.url, ep.guid)] = ep.id;
    }
    const patch = [];
    for (const [key, s] of Object.entries(data.state)) {
      const id = idByKey[key];
      if (id) patch.push([id, { ...EMPTY_STATE, ...s, updatedAt: Date.now() }]);
    }
    if (patch.length) {
      await db.task('state', 'readwrite', store => { for (const [id, s] of patch) store.put(s, id); });
      merge(stateMap, patch);
    }
  }

  return results;
}

// ── helpers ──

/** tidy a pasted feed url — trim, add https://, drop a leading podcast:// */
export function normalizeUrl (raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  url = url.replace(/^podcast:\/\//i, 'https://').replace(/^feed:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}
