// apps/podcasts/db.js
//
// the storage layer. everything the app knows lives in one @bunker/db
// (IndexedDB) database with three tables, mirrored into three preact signals so
// the whole ui stays reactive without any component ever touching IndexedDB:
//
//   podcasts   key = podcastId            the subscriptions
//   episodes   key = `${podcastId}:${h}`  every episode of every subscription
//   state      key = episodeId            per-episode { position, done, saved }
//
// keys are strings and @bunker/db sorts them lexicographically, so an episode
// key that starts with its podcastId makes "all episodes of this podcast" a
// plain prefix scan — no secondary index needed.
//
// the three signals (`podcasts`, `episodes`, `states`) are the single source of
// truth the components read; every mutation writes IndexedDB *and* updates the
// signal, so a change shows up everywhere at once and survives a reload.

import { signal, computed } from '@aufbau/kits/preact-htm';
import { createDb } from '@bunker/db';

import { fetchFeed, parseFeed } from './feed.js';

const db = createDb('zugriff-podcasts');

// ── ids ──────────────────────────────────────────────────────────────────
// a small, stable string hash (cyrb53). feed urls and guids can be long and
// full of characters we would rather not put in a key, so both are hashed to a
// short base-36 token. the same input always yields the same id, which is what
// lets progress survive a re-fetch.

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

export const podcastId  = url         => 'p' + hash(url);
export const episodeId  = (pid, guid) => pid + ':' + hash(guid);

// ── signals ────────────────────────────────────────────────────────────────

export const podcasts = signal([]);          // array of podcast records
export const episodes = signal([]);          // flat array of every episode
export const states   = signal({});          // episodeId -> state record
export const ready    = signal(false);       // false until the first load lands

// episodes grouped once, so a podcast view is a lookup instead of a filter
export const episodesByPodcast = computed(() => {
  const map = {};
  for (const ep of episodes.value) (map[ep.podcastId] ??= []).push(ep);
  return map;
});

// ── loading ──────────────────────────────────────────────────────────────

export async function load () {
  // create all three stores in ONE upgrade before touching them. without this,
  // the three reads below would each lazily trigger their own version-upgrade to
  // create a missing store, and those upgrade cycles overlap with each other's
  // read transactions on a cold database — which is exactly the "upgrade blocked
  // by another connection" error on first load. setup() is idempotent, so on
  // every later load it opens no upgrade at all.
  await db.setup({ podcasts: {}, episodes: {}, state: {} });

  const [pods, eps, st] = await Promise.all([
    db.getAll('podcasts'),
    db.getAll('episodes'),
    db.getAll('state'),
  ]);
  podcasts.value = Object.values(pods);
  episodes.value = Object.values(eps);
  states.value   = st;
  ready.value    = true;
}

// ── state (progress / done / saved) ──────────────────────────────────────

const EMPTY_STATE = { position: 0, duration: 0, done: false, doneAt: 0, saved: false, savedAt: 0, updatedAt: 0 };

export const stateOf = id => states.value[id] ?? EMPTY_STATE;

/** merge `patch` into an episode's state, persist it and refresh the signal */
export async function patchState (id, patch) {
  const next = { ...EMPTY_STATE, ...states.value[id], ...patch, updatedAt: Date.now() };
  states.value = { ...states.value, [id]: next };
  await db.set('state', id, next);
  return next;
}

export const setProgress = (id, position, duration) =>
  patchState(id, { position, duration });

export async function markDone (id, done = true) {
  return patchState(id, { done, doneAt: done ? Date.now() : 0 });
}

export async function toggleDone (id) {
  const cur = stateOf(id);
  return markDone(id, !cur.done);
}

export async function toggleSaved (id) {
  const cur = stateOf(id);
  return patchState(id, { saved: !cur.saved, savedAt: !cur.saved ? Date.now() : 0 });
}

/** every saved episode, newest-saved first, joined to its episode record */
export const savedEpisodes = computed(() => {
  const byId = Object.fromEntries(episodes.value.map(ep => [ep.id, ep]));
  return Object.entries(states.value)
    .filter(([, s]) => s.saved)
    .map(([id, s]) => ({ episode: byId[id], savedAt: s.savedAt }))
    .filter(row => row.episode)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(row => row.episode);
});

// ── subscriptions ──────────────────────────────────────────────────────────

/** turn a parsed feed into our records, keyed and hashed */
function toRecords (url, parsed) {
  const pid = podcastId(url);

  const eps = parsed.episodes.map(ep => {
    const guid = ep.guid || ep.audioUrl || ep.link || ep.title;
    return {
      id        : episodeId(pid, guid),
      podcastId : pid,
      guid,
      title     : ep.title,
      description : ep.description,
      audioUrl  : ep.audioUrl,
      audioType : ep.audioType,
      pubDate   : ep.pubDate,
      duration  : ep.duration,
      image     : ep.image,
      link      : ep.link,
    };
  }).filter(ep => ep.audioUrl);       // an episode with no audio is nothing to play

  const lastEpisodeAt = eps.reduce((max, ep) => Math.max(max, ep.pubDate || 0), 0);

  const podcast = {
    id          : pid,
    url,
    title       : parsed.title || url,
    description : parsed.description,
    author      : parsed.author,
    image       : parsed.image,
    link        : parsed.link,
    addedAt     : Date.now(),
    lastFetched : Date.now(),
    lastEpisodeAt,
    episodeCount: eps.length,
  };

  return { podcast, eps };
}

async function writeEpisodes (eps) {
  if (!eps.length) return;
  await db.task('episodes', 'readwrite', store => {
    for (const ep of eps) store.put(ep, ep.id);
  });
}

/**
 * subscribe to a feed by url. fetches, parses and stores it. throws on a bad
 * feed or an unreachable url so the caller can surface the message.
 */
export async function subscribe (rawUrl, proxy) {
  const url = normalizeUrl(rawUrl);
  const pid = podcastId(url);
  if (podcasts.value.some(p => p.id === pid)) {
    throw new Error('already subscribed to this feed');
  }

  const xml    = await fetchFeed(url, proxy);
  const parsed = parseFeed(xml);
  if (!parsed.episodes.length) throw new Error('no episodes found in this feed');

  const { podcast, eps } = toRecords(url, parsed);

  await db.set('podcasts', pid, podcast);
  await writeEpisodes(eps);

  podcasts.value = [...podcasts.value, podcast];
  episodes.value = [...episodes.value, ...eps];
  return podcast;
}

/** re-fetch one subscription and merge in any new episodes */
export async function refresh (pid, proxy) {
  const podcast = podcasts.value.find(p => p.id === pid);
  if (!podcast) return;

  const xml    = await fetchFeed(podcast.url, proxy);
  const parsed = parseFeed(xml);
  const { podcast: fresh, eps } = toRecords(podcast.url, parsed);

  const known = new Set(episodes.value.filter(e => e.podcastId === pid).map(e => e.id));
  const added = eps.filter(e => !known.has(e.id));

  // rewrite every episode (metadata may have changed) but keep addedAt on the podcast
  await writeEpisodes(eps);
  const merged = {
    ...podcast, ...fresh,
    addedAt      : podcast.addedAt,
    lastFetched  : Date.now(),
  };
  await db.set('podcasts', pid, merged);

  const others = episodes.value.filter(e => e.podcastId !== pid);
  episodes.value = [...others, ...eps];
  podcasts.value = podcasts.value.map(p => p.id === pid ? merged : p);
  return { added: added.length };
}

export async function refreshAll (proxy, onProgress) {
  let done = 0;
  const total = podcasts.value.length;
  const results = [];
  for (const p of [...podcasts.value]) {
    try { results.push(await refresh(p.id, proxy)); }
    catch (err) { results.push({ error: err?.message || String(err), podcast: p }); }
    onProgress?.(++done, total);
  }
  return results;
}

/** drop a subscription along with its episodes and their state */
export async function unsubscribe (pid) {
  const doomed = episodes.value.filter(e => e.podcastId === pid).map(e => e.id);

  await db.delete('podcasts', pid);
  await db.task('episodes', 'readwrite', store => {
    for (const id of doomed) store.delete(id);
  });
  await db.task('state', 'readwrite', store => {
    for (const id of doomed) store.delete(id);
  });

  podcasts.value = podcasts.value.filter(p => p.id !== pid);
  episodes.value = episodes.value.filter(e => e.podcastId !== pid);
  const st = { ...states.value };
  for (const id of doomed) delete st[id];
  states.value = st;
}

// ── import / export ────────────────────────────────────────────────────────

/**
 * a backup of the subscriptions plus per-episode state. state is keyed by the
 * feed url + episode guid so it re-attaches after an import re-fetches the
 * feeds — the ids are derived from exactly those two strings.
 */
export function exportData () {
  const byId = Object.fromEntries(episodes.value.map(ep => [ep.id, ep]));

  const stateByGuid = {};
  for (const [id, s] of Object.entries(states.value)) {
    const ep = byId[id];
    if (!ep) continue;
    if (!s.saved && !s.done && !s.position) continue;   // nothing worth keeping
    const podcast = podcasts.value.find(p => p.id === ep.podcastId);
    if (!podcast) continue;
    stateByGuid[`${podcast.url} ${ep.guid}`] = {
      position: s.position, duration: s.duration,
      done: s.done, doneAt: s.doneAt, saved: s.saved, savedAt: s.savedAt,
    };
  }

  return {
    app        : 'zugriff-podcasts',
    version    : 1,
    exportedAt : new Date().toISOString(),
    feeds      : podcasts.value.map(p => ({ url: p.url, title: p.title })),
    state      : stateByGuid,
  };
}

/**
 * import a backup. subscribes to any feed not already present, then re-applies
 * saved state onto whatever episodes now exist. reports per-feed outcomes.
 */
export async function importData (data, proxy, onProgress) {
  if (!data || !Array.isArray(data.feeds)) throw new Error('not a podcasts export file');

  const results = [];
  let done = 0;
  for (const feed of data.feeds) {
    const url = normalizeUrl(feed.url || '');
    if (!url) { results.push({ url: feed.url, skipped: 'no url' }); continue; }
    const pid = podcastId(url);
    if (podcasts.value.some(p => p.id === pid)) {
      results.push({ url, skipped: 'already subscribed' });
    } else {
      try { await subscribe(url, proxy); results.push({ url, added: true }); }
      catch (err) { results.push({ url, error: err?.message || String(err) }); }
    }
    onProgress?.(++done, data.feeds.length);
  }

  // re-apply state now that the episodes exist
  if (data.state) {
    const patch = {};
    const byGuid = {};
    for (const ep of episodes.value) {
      const podcast = podcasts.value.find(p => p.id === ep.podcastId);
      if (podcast) byGuid[`${podcast.url} ${ep.guid}`] = ep.id;
    }
    for (const [key, s] of Object.entries(data.state)) {
      const id = byGuid[key];
      if (!id) continue;
      patch[id] = { ...EMPTY_STATE, ...s, updatedAt: Date.now() };
    }
    if (Object.keys(patch).length) {
      await db.task('state', 'readwrite', store => {
        for (const [id, s] of Object.entries(patch)) store.put(s, id);
      });
      states.value = { ...states.value, ...patch };
    }
  }

  return results;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** tidy a pasted feed url — trim, add https://, drop a leading podcast:// */
export function normalizeUrl (raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  url = url.replace(/^podcast:\/\//i, 'https://').replace(/^feed:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}
