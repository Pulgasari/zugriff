// apps/podcasts/modules/db.js
// storage layer. one @bunker/db (indexeddb) is the durable store; three reactive
// maps mirror it so the ui stays live. the public surface is `default` (app.db):
// two collections + a handful of actions, all reactive without touching .value.
//
//   podcasts  id                   -> podcast record
//   episodes  `${podcastId}:${h}`  -> episode record   (prefix-scannable per podcast)
//   state     episodeId            -> { position, done, saved, ... }

import { makeMap, signal }     from '@aufbau/signals';
import { createDb }            from '@bunker/db';
import { fetchFeed, parseFeed } from './feed.js';

const store = createDb('zugriff-podcasts');

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

const podcastId = url         => 'p' + hash(url);
const episodeId = (pid, guid) => `${pid}:${hash(guid)}`;

// ── reactive mirror ──

const podcastMap = makeMap();   // id        -> podcast
const episodeMap = makeMap();   // episodeId -> episode
const stateMap   = makeMap();   // episodeId -> state
const readySig   = signal(false);

// a reactive view over a makeMap keyed by id. reads go through the map's signal,
// so `.all`, `.get`, `.where` and iteration all track without a .value in sight.
function collection (map) {
  const list  = () => [...map.values()];
  const match = q => typeof q === 'function' ? q : rec => Object.keys(q).every(k => rec[k] === q[k]);

  return {
    get all  () { return list(); },
    get size () { return map.size; },
    get   : q => q == null                                                  ? undefined
               : typeof q === 'string'                                      ? map.get(q)
               : typeof q === 'object' && Object.keys(q).length === 1 && 'id' in q ? map.get(q.id)
               :                                                              list().find(match(q)),
    where : q => q == null ? list() : list().filter(match(q)),
    [Symbol.iterator] : () => map.values(),
  };
}

const podcasts = collection(podcastMap);
const episodes = collection(episodeMap);

// merge entries into a map in one publish (per-key set would copy the map each time)
const merge = (map, entries) => map.replace([...map.entries(), ...entries]);

// ── loading ──

async function load () {
  // create all three stores in ONE upgrade before reading them; otherwise the three
  // reads each trigger their own lazy upgrade and those cycles race on a cold db
  // ("upgrade blocked by another connection"). setup() is idempotent afterwards.
  await store.setup({ podcasts: {}, episodes: {}, state: {} });

  const [pods, eps, st] = await Promise.all([
    store.podcasts.getAll(),
    store.episodes.getAll(),
    store.state.getAll(),
  ]);
  podcastMap.replace(pods);
  episodeMap.replace(eps);
  stateMap.replace(st);
  readySig.value = true;
}

// ── state (progress / done / saved) ──

const EMPTY_STATE = { position: 0, duration: 0, done: false, doneAt: 0, saved: false, savedAt: 0, updatedAt: 0 };

const stateOf = id => stateMap.get(id) ?? EMPTY_STATE;

/** merge `patch` into an episode's state, persist it and refresh the mirror */
async function patchState (id, patch) {
  const next = { ...EMPTY_STATE, ...stateMap.get(id), ...patch, updatedAt: Date.now() };
  stateMap.set(id, next);
  await store.state.set(id, next);
  return next;
}

const setProgress = (id, position, duration) => patchState(id, { position, duration });
const markDone    = (id, done = true)        => patchState(id, { done, doneAt: done ? Date.now() : 0 });
const toggleDone  = id => markDone(id, !stateOf(id).done);
const toggleSaved = id => {
  const cur = stateOf(id);
  return patchState(id, { saved: !cur.saved, savedAt: !cur.saved ? Date.now() : 0 });
};

// every saved episode, newest-saved first, joined to its episode record
const savedList = () =>
  [...stateMap.entries()]
    .filter(([, s]) => s.saved)
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .map(([id]) => episodeMap.get(id))
    .filter(Boolean);

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
  eps.length && store.task('episodes', 'readwrite', s => { for (const ep of eps) s.put(ep, ep.id); });

/**
 * subscribe to a feed by url. fetches, parses and stores it. throws on a bad feed
 * or an unreachable url so the caller can surface the message.
 */
async function subscribe (rawUrl, proxy) {
  const url = normalizeUrl(rawUrl);
  const pid = podcastId(url);
  if (podcastMap.has(pid)) throw new Error('already subscribed to this feed');

  const parsed = parseFeed(await fetchFeed(url, proxy));
  if (!parsed.episodes.length) throw new Error('no episodes found in this feed');

  const { podcast, eps } = toRecords(url, parsed);

  await store.podcasts.set(pid, podcast);
  await writeEpisodes(eps);

  podcastMap.set(pid, podcast);
  merge(episodeMap, eps.map(ep => [ep.id, ep]));
  return podcast;
}

/** re-fetch one subscription and merge in any new episodes */
async function refresh (pid, proxy) {
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
  await store.podcasts.set(pid, merged);

  const others = [...episodeMap.entries()].filter(([k]) => !k.startsWith(prefix));
  episodeMap.replace([...others, ...eps.map(ep => [ep.id, ep])]);
  podcastMap.set(pid, merged);
  return { added };
}

async function refreshAll (proxy, onProgress) {
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
async function unsubscribe (pid) {
  const prefix = pid + ':';
  const keys   = await store.episodes.keys(prefix);   // every stored episode of this podcast

  await store.podcasts.delete(pid);
  await store.task('episodes', 'readwrite', s => { for (const id of keys) s.delete(id); });
  await store.task('state',    'readwrite', s => { for (const id of keys) s.delete(id); });

  podcastMap.delete(pid);
  episodeMap.replace([...episodeMap.entries()].filter(([k]) => !k.startsWith(prefix)));
  stateMap.replace([...stateMap.entries()].filter(([k]) => !k.startsWith(prefix)));
}

// ── import / export ──
// state is keyed by feed url + episode guid so it re-attaches after an import
// re-fetches the feeds — the ids are derived from exactly those two strings.

const stateKey = (url, guid) => `${url}\n${guid}`;

function exportData () {
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

async function importData (data, proxy, onProgress) {
  if (!data || !Array.isArray(data.feeds)) throw new Error('not a podcasts export file');

  const results = [];
  let done = 0;
  for (const feed of data.feeds) {
    const url = normalizeUrl(feed.url || '');
    if (!url)                                results.push({ url: feed.url, skipped: 'no url' });
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
      await store.task('state', 'readwrite', s => { for (const [id, rec] of patch) s.put(rec, id); });
      merge(stateMap, patch);
    }
  }

  return results;
}

// ── helpers ──

/** tidy a pasted feed url — trim, add https://, drop a leading podcast:// */
function normalizeUrl (raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  url = url.replace(/^podcast:\/\//i, 'https://').replace(/^feed:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

// ── public surface ──

// named exports for direct importers (player.js reads state)
export { stateOf, setProgress, markDone, podcastId, episodeId };

// default handle is app.db — collections + actions, all reactive, no .value
export default {
  podcasts,
  episodes,
  stateOf,
  get savedEpisodes () { return savedList(); },
  get ready ()        { return readySig.value; },

  load,
  subscribe, refresh, refreshAll, unsubscribe,
  toggleDone, toggleSaved, setProgress, markDone,
  exportData, importData,
  normalizeUrl,
};
