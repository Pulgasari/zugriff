// podcasts :: modules/database.js
//
// storage over @bunker/db (indexeddb). three tables:
//
//   podcasts  id                   -> the parsed feed, minus its episodes
//   episodes  `${podcastId}:${h}`  -> the parsed entry, plus its ids
//   state     episodeId            -> { position, duration, done, saved, … }
//
// what a feed parses to is what gets stored. the only fields added on the way in
// are the keys (id, podcastId) and a few counters the lists sort by — no record
// is copied field by field, so whatever feed.js learns to parse lands in the db
// without a second round of mapping here.
//
// reads are synchronous over an in-memory mirror that load() fills once at boot;
// writes go to indexeddb and patch the mirror. there is no reactivity in here —
// re-rendering after a write is the app's business, not the storage layer's.

// :::::: IMPORTS

import { createDb }             from '@bunker/db';
import { fetchFeed, parseFeed } from './feed.js';
import { hash }                 from './methods.js';

// :::::: CONSTANTS

const EMPTY_STATE = { position: 0, duration: 0, done: false, doneAt: 0, saved: false, savedAt: 0, updatedAt: 0 };

// :::::: DB

const database = createDb('zugriff:podcasts');

// the mirror. plain objects keyed by id, so every read below is a lookup.
let podcasts = {};
let episodes = {};
let states   = {};

// all three tables in ONE upgrade. reading a table that does not exist yet
// triggers its own lazy upgrade, and three of those race on a cold db.
// setup() is a no-op from the second call on.
async function load () {
  await database.setup({ podcasts: {}, episodes: {}, state: {} });

  [podcasts, episodes, states] = await Promise.all([
    database.podcasts.toMap(),
    database.episodes.toMap(),
    database.state.toMap(),
  ]);
}

// :::::: IDS
// cyrb53 (methods.js): a short, stable base-36 hash, so long urls and guids stay
// out of the keys. same input -> same id, which is what lets listening state
// survive a re-fetch. the podcast id prefixes its episodes' keys, so "everything
// of this podcast" is a plain prefix scan.

const podcastId = url         => 'p' + hash(url);
const episodeId = (pid, guid) => `${pid}:${hash(guid)}`;

// :::::: READ

const getPodcasts = ()    => Object.values(podcasts);
const getPodcast  = (id)  => podcasts[id] ?? null;

const getEpisode  = (id)  => episodes[id] ?? null;
const getEpisodes = (pid) => {
  const all = Object.values(episodes);
  return pid ? all.filter(episode => episode.podcastId === pid) : all;
};

const stateOf = id => states[id] ?? EMPTY_STATE;

// the listen-later list, newest-saved first, joined to its episode
const getSaved = () => Object.entries(states)
  .filter(([, state]) => state.saved)
  .sort(([, a], [, b]) => b.savedAt - a.savedAt)
  .map(([id]) => episodes[id])
  .filter(Boolean);

// :::::: STATE (progress / done / saved)

async function patchState (id, patch) {
  const next = { ...EMPTY_STATE, ...states[id], ...patch, updatedAt: Date.now() };
  states[id] = next;
  await database.state.set(id, next);
  return next;
}

const setProgress = (id, position, duration) => patchState(id, { position, duration });
const markDone    = (id, done = true)        => patchState(id, { done, doneAt: done ? Date.now() : 0 });
const toggleDone  = (id)                     => markDone(id, !stateOf(id).done);
const toggleSaved = (id) => {
  const saved = !stateOf(id).saved;
  return patchState(id, { saved, savedAt: saved ? Date.now() : 0 });
};

// :::::: SUBSCRIPTIONS

// a parsed feed, keyed: the podcast is the feed itself minus its episodes, each
// episode the parsed entry plus its ids. guid is normalized here because the
// export keys listening state by it, and not every feed sets one.
function toRecords (url, { episodes: entries, ...feed }) {
  const pid = podcastId(url);

  const eps = entries
    .filter(entry => entry.audioUrl)            // an episode with no audio is nothing to play
    .map(entry => {
      const guid = entry.guid || entry.audioUrl;
      return { ...entry, guid, id: episodeId(pid, guid), podcastId: pid };
    });

  const podcast = {
    ...feed,
    id            : pid,
    url,
    title         : feed.title || url,
    lastFetched   : Date.now(),
    lastEpisodeAt : eps.reduce((max, ep) => Math.max(max, ep.pubDate || 0), 0),
    episodeCount  : eps.length,
  };

  return { podcast, episodes: eps };
}

// one transaction for the whole feed — a put per episode would open one each
const putEpisodes = (eps)          => database.task('episodes', 'readwrite', os => { for (const ep  of eps)  os.put(ep, ep.id); });
const dropKeys    = (table, keys)  => database.task(table,      'readwrite', os => { for (const key of keys) os.delete(key);    });

// write a feed's records to both the db and the mirror
async function store (podcast, eps) {
  await database.podcasts.set(podcast.id, podcast);
  await putEpisodes(eps);

  podcasts[podcast.id] = podcast;
  for (const ep of eps) episodes[ep.id] = ep;
}

/**
 * subscribe to a feed by url. fetches, parses and stores it. throws on a bad feed
 * or an unreachable url so the caller can surface the message.
 */
async function subscribe (rawUrl) {
  const url = normalizeUrl(rawUrl);
  const pid = podcastId(url);
  if (podcasts[pid]) throw new Error('already subscribed to this feed');

  const parsed = parseFeed(await fetchFeed(url));
  if (!parsed.episodes.length) throw new Error('no episodes found in this feed');

  const { podcast, episodes: eps } = toRecords(url, parsed);
  await store({ ...podcast, addedAt: Date.now() }, eps);
  return podcasts[pid];
}

/**
 * re-fetch one subscription. every episode is rewritten, since titles, artwork
 * and descriptions change in place; episodes a feed has since dropped are kept,
 * so a truncated feed does not take their progress with it.
 */
async function refresh (pid) {
  const known = podcasts[pid];
  if (!known) return { added: 0 };

  const parsed = parseFeed(await fetchFeed(known.url));
  const { podcast, episodes: eps } = toRecords(known.url, parsed);
  const added = eps.filter(ep => !episodes[ep.id]).length;

  await store({ ...podcast, addedAt: known.addedAt }, eps);
  return { added };
}

async function refreshAll (onProgress) {
  const all     = getPodcasts();
  const results = [];
  let   done    = 0;

  for (const podcast of all) {
    try           { results.push(await refresh(podcast.id)); }
    catch (error) { results.push({ podcast, error: error?.message || String(error) }); }
    onProgress?.(++done, all.length);
  }
  return results;
}

/** drop a subscription along with its episodes and their state */
async function unsubscribe (pid) {
  const keys = Object.keys(episodes).filter(key => key.startsWith(pid + ':'));

  await database.podcasts.delete(pid);
  await dropKeys('episodes', keys);
  await dropKeys('state',    keys);

  delete podcasts[pid];
  for (const key of keys) { delete episodes[key]; delete states[key]; }
}

// :::::: IMPORT / EXPORT
// state is keyed by feed url + episode guid rather than by our own ids, so it
// re-attaches after an import has re-fetched the feeds — the ids are derived
// from exactly those two strings.

const stateKey = (url, guid) => `${url}\n${guid}`;

function exportData () {
  const state = {};

  for (const [id, { updatedAt, ...rest }] of Object.entries(states)) {
    if (!rest.saved && !rest.done && !rest.position) continue;   // nothing worth keeping
    const episode = episodes[id];
    const podcast = episode && podcasts[episode.podcastId];
    if (podcast) state[stateKey(podcast.url, episode.guid)] = rest;
  }

  return {
    app        : 'zugriff-podcasts',
    version    : 1,
    exportedAt : new Date().toISOString(),
    feeds      : getPodcasts().map(({ url, title }) => ({ url, title })),
    state,
  };
}

async function importData (data, onProgress) {
  if (!data || !Array.isArray(data.feeds)) throw new Error('not a podcasts export file');

  const results = [];
  let   done    = 0;

  for (const feed of data.feeds) {
    const url = normalizeUrl(feed.url || '');
    if      (!url)                     results.push({ url: feed.url, skipped: 'no url' });
    else if (podcasts[podcastId(url)]) results.push({ url, skipped: 'already subscribed' });
    else {
      try           { await subscribe(url); results.push({ url, added: true }); }
      catch (error) { results.push({ url, error: error?.message || String(error) }); }
    }
    onProgress?.(++done, data.feeds.length);
  }

  // re-apply the saved state now that the episodes exist
  const rows = [];
  for (const episode of Object.values(episodes)) {
    const podcast = podcasts[episode.podcastId];
    const saved   = podcast && data.state?.[stateKey(podcast.url, episode.guid)];
    if (saved) rows.push([episode.id, { ...EMPTY_STATE, ...saved, updatedAt: Date.now() }]);
  }
  if (rows.length) {
    await database.task('state', 'readwrite', os => { for (const [id, row] of rows) os.put(row, id); });
    for (const [id, row] of rows) states[id] = row;
  }

  return results;
}

// :::::: HELPERS

/** tidy a pasted feed url — trim, add https://, drop a leading podcast:// */
function normalizeUrl (raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  url = url.replace(/^(podcast|feed):\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

// :::::: EXPORT

// named exports for direct importers — player.js writes progress
export { database, load, podcastId, episodeId, stateOf, setProgress, markDone, normalizeUrl };

// the default is app.db
export default {
  load,

  getPodcast, getPodcasts,
  getEpisode, getEpisodes,
  getSaved,   stateOf,

  setProgress, markDone, toggleDone, toggleSaved,
  subscribe, refresh, refreshAll, unsubscribe,
  exportData, importData, normalizeUrl,
};
