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
// indexeddb is async, preact renders synchronously, so the library is mirrored in
// app.state and read from there. no signals in this file: app.state is already the
// app's deep signal, and writing a leaf is what re-renders the views.
//
//   app.state.podcasts  []                 array leaf -> one signal, replaced on write
//   app.state.episodes  []                 same
//   app.state.progress  { episodeId: … }   keyed node -> one signal per episode, so the
//                                          player's position writes wake only the rows
//                                          showing that episode (the `state` table)

// :::::: IMPORTS

import { createDb }             from '@bunker/db';
import { fetchFeed, parseFeed } from './feed.js';
import { hash }                 from './methods.js';

// :::::: CONSTANTS

const app = zugriff.app;

const EMPTY_PROGRESS = { position: 0, duration: 0, done: false, doneAt: 0, saved: false, savedAt: 0, updatedAt: 0 };

// :::::: DB

const database = createDb('zugriff:podcasts');

// all three tables in ONE upgrade. reading a table that does not exist yet
// triggers its own lazy upgrade, and three of those race on a cold db.
// setup() is a no-op from the second call on.


// :::::: IDS
// cyrb53 (methods.js): a short, stable base-36 hash, so long urls and guids stay
// out of the keys. same input -> same id, which is what lets listening state
// survive a re-fetch. the podcast id prefixes its episodes' keys, so "everything
// of this podcast" is a plain prefix scan.

const podcastId = url         => 'p' + hash(url);
const episodeId = (pid, guid) => `${pid}:${hash(guid)}`;

// :::::: READ

// the list reads copy: what app.state holds is the live array, and a caller that
// sorts in place would reorder the state itself without publishing it.
const getPodcasts = ()    => [...app.state.podcasts];
const getPodcast  = (id)  => app.state.podcasts.find(podcast => podcast.id === id) ?? null;

const getEpisode  = (id)  => app.state.episodes.find(episode => episode.id === id) ?? null;
const getEpisodes = (pid) => pid ? app.state.episodes.filter(episode => episode.podcastId === pid)
                                 : [...app.state.episodes];

// an episode that already has progress reads its own signals and nothing else. one
// that has none has no signal to subscribe to yet, so it falls back to $keys, which
// fires when the key appears. keeping that fallback off the hit path matters: $keys
// wakes every reader holding it, and the first write for any episode fires it.
const stateOf = (id) => {
  const progress = app.state.progress[id];
  if (progress) return progress;

  void app.state.progress.$keys;
  return EMPTY_PROGRESS;
};

// the listen-later list, newest-saved first, joined to its episode
const getSaved = () => Object.entries(app.state.progress)
  .filter(([, progress]) => progress.saved)
  .sort(([, a], [, b]) => b.savedAt - a.savedAt)
  .map(([id]) => getEpisode(id))
  .filter(Boolean);

// :::::: STATE (progress / done / saved)

async function patchProgress (id, patch) {
  const next = { ...EMPTY_PROGRESS, ...app.state.progress[id], ...patch, updatedAt: Date.now() };
  app.state.progress[id] = next;
  await database.state.set(id, next);
  return next;
}

const setProgress = (id, position, duration) => patchProgress(id, { position, duration });
const markDone    = (id, done = true)        => patchProgress(id, { done, doneAt: done ? Date.now() : 0 });
const toggleDone  = (id)                     => markDone(id, !stateOf(id).done);
const toggleSaved = (id) => {
  const saved = !stateOf(id).saved;
  return patchProgress(id, { saved, savedAt: saved ? Date.now() : 0 });
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

// write a feed's records to the db, then swap them into app.state in one
// assignment per collection — a per-record write would publish that many times.
async function store (podcast, eps) {
  await database.podcasts.set(podcast.id, podcast);
  await putEpisodes(eps);

  const fresh = new Set(eps.map(ep => ep.id));
  app.state.podcasts = [...app.state.podcasts.filter(p  => p.id !== podcast.id), podcast];
  app.state.episodes = [...app.state.episodes.filter(ep => !fresh.has(ep.id)),   ...eps];
}

/**
 * subscribe to a feed by url. fetches, parses and stores it. throws on a bad feed
 * or an unreachable url so the caller can surface the message.
 */
async function subscribe (rawUrl) {
  const url = normalizeUrl(rawUrl);
  const pid = podcastId(url);
  if (getPodcast(pid)) throw new Error('already subscribed to this feed');

  const parsed = parseFeed(await fetchFeed(url));
  if (!parsed.episodes.length) throw new Error('no episodes found in this feed');

  const { podcast, episodes: eps } = toRecords(url, parsed);
  await store({ ...podcast, addedAt: Date.now() }, eps);
  return getPodcast(pid);
}

/**
 * re-fetch one subscription. every episode is rewritten, since titles, artwork
 * and descriptions change in place; episodes a feed has since dropped are kept,
 * so a truncated feed does not take their progress with it.
 */
async function refresh (pid) {
  const known = getPodcast(pid);
  if (!known) return { added: 0 };

  const parsed = parseFeed(await fetchFeed(known.url));
  const { podcast, episodes: eps } = toRecords(known.url, parsed);

  const have  = new Set(app.state.episodes.map(episode => episode.id));
  const added = eps.filter(ep => !have.has(ep.id)).length;

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
  const keys = getEpisodes(pid).map(episode => episode.id);

  await database.podcasts.delete(pid);
  await dropKeys('episodes', keys);
  await dropKeys('state',    keys);

  app.state.podcasts = app.state.podcasts.filter(podcast => podcast.id   !== pid);
  app.state.episodes = app.state.episodes.filter(episode => episode.podcastId !== pid);
  for (const key of keys) delete app.state.progress[key];
}

// :::::: IMPORT / EXPORT
// state is keyed by feed url + episode guid rather than by our own ids, so it
// re-attaches after an import has re-fetched the feeds — the ids are derived
// from exactly those two strings.

const stateKey = (url, guid) => `${url}\n${guid}`;

function exportData () {
  const state = {};

  for (const [id, { updatedAt, ...rest }] of Object.entries(app.state.progress)) {
    if (!rest.saved && !rest.done && !rest.position) continue;   // nothing worth keeping
    const episode = getEpisode(id);
    const podcast = episode && getPodcast(episode.podcastId);
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
    if      (!url)                    results.push({ url: feed.url, skipped: 'no url' });
    else if (getPodcast(podcastId(url))) results.push({ url, skipped: 'already subscribed' });
    else {
      try           { await subscribe(url); results.push({ url, added: true }); }
      catch (error) { results.push({ url, error: error?.message || String(error) }); }
    }
    onProgress?.(++done, data.feeds.length);
  }

  // re-apply the saved state now that the episodes exist
  const rows = [];
  for (const episode of app.state.episodes) {
    const podcast = getPodcast(episode.podcastId);
    const saved   = podcast && data.state?.[stateKey(podcast.url, episode.guid)];
    if (saved) rows.push([episode.id, { ...EMPTY_PROGRESS, ...saved, updatedAt: Date.now() }]);
  }
  if (rows.length) {
    await database.task('state', 'readwrite', os => { for (const [id, row] of rows) os.put(row, id); });
    for (const [id, row] of rows) app.state.progress[id] = row;
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
  //load,

  getPodcast, getPodcasts,
  getEpisode, getEpisodes,
  getSaved,   stateOf,

  setProgress, markDone, toggleDone, toggleSaved,
  subscribe, refresh, refreshAll, unsubscribe,
  exportData, importData, normalizeUrl,
};
