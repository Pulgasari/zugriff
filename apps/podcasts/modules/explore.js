// podcasts :: modules/explore.js
//
// the other half of the library: podcasts that are not in it (yet). searching the
// directory, reading a feed without subscribing to it, and the shortlist — the ones
// that caught the eye and want a closer look later.
//
// nothing here writes to `podcasts` or `episodes`. a preview is keyed by the very
// function a subscription is keyed by (library.js :: toRecords), so an episode looked
// at today and subscribed to tomorrow keeps its id, and with it its progress.

// :::::: IMPORTS

import { fetchFeed, parseFeed }                  from './feed.js';
import { normalizeUrl, podcastIdByHash, toRecords } from './library.js';
import { searchPodcasts }                        from './search.js';

// :::::: CONSTANTS

const app = zugriff.app;

// :::::: HELPERS

// a directory hit, a shortlist row and a preview all describe the same podcast, so
// they are all read through this: the feed url, and our own id derived from it.
const urlOf = (entry = {}) => normalizeUrl(entry.url || entry.feedUrl || '');
const idOf  = (entry = {}) => entry.id || podcastIdByHash(urlOf(entry));

// :::::: SEARCH

/**
 * search the directory by name. the directory's own id is replaced by ours, so a
 * result, a shortlist row and a subscription speak about a podcast in one key —
 * which is what makes "already subscribed" a plain lookup instead of a url compare.
 */
async function search (term, options) {
  const results = await searchPodcasts(term, options);
  return results.map(result => {
    const url = normalizeUrl(result.feedUrl);
    return { ...result, url, id: podcastIdByHash(url) };
  });
}

// :::::: PREVIEW
// a feed fetched and parsed but not stored. cached per url for the session: walking
// out of a podcast and back into it should not go down the proxy again.

const previews = new Map();   // url -> promise of { url, id, feed, podcast, episodes }

/** read a feed without subscribing to it. throws the same way subscribing does. */
function preview (rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return Promise.reject(new Error('no feed url'));
  if (previews.has(url)) return previews.get(url);

  const job = (async () => {
    const feed = parseFeed(await fetchFeed(url));
    return { url, id: podcastIdByHash(url), feed, ...toRecords(url, feed) };
  })();

  // a failed fetch must not be what every later visit gets handed back
  job.catch(() => previews.delete(url));

  previews.set(url, job);
  return job;
}

// :::::: SHORTLIST
// "merken": a podcast that is interesting but has not earned a subscription yet. a
// table rather than a mirror — the views read it through useTable like any other.

/** what a shortlist row keeps: enough for a list, plus the url to go back to the feed */
const toRow = (entry) => ({
  id      : idOf(entry),
  url     : urlOf(entry),
  title   : entry.title  || urlOf(entry),
  author  : entry.author || '',
  image   : entry.image  || '',
  genre   : entry.genre  || '',
  count   : entry.count  ?? entry.episodeCount ?? 0,
  addedAt : Date.now(),
});

const shortlist = () => app.db.shortlist.toValues();

async function remember (entry) {
  const row = toRow(entry);
  if (!row.url) throw new Error('no feed url to remember');
  await app.db.shortlist.set(row.id, row);
  return row;
}

const forget = (entry) => app.db.shortlist.delete(idOf(entry));

/** returns whether the podcast is on the shortlist afterwards */
async function toggleRemembered (entry) {
  const id = idOf(entry);
  if (await app.db.shortlist.get(id)) { await app.db.shortlist.delete(id); return false; }
  await remember(entry);
  return true;
}

// :::::: SUBSCRIBE

/**
 * subscribe from an explore entry. reuses the parsed feed when this session has
 * already previewed it, and drops the shortlist row — the podcast is in the library
 * now, which is where the shortlist was pointing all along.
 */
async function subscribe (entry) {
  const url = urlOf(entry);
  const has = previews.has(url) ? await previews.get(url).catch(() => null) : null;

  const podcast = await app.library.subscribe(url, has?.feed);
  await app.db.shortlist.delete(podcast.id);
  return podcast;
}

// :::::: EXPORT

export { search, preview, shortlist, remember, forget, toggleRemembered, subscribe, idOf, urlOf };

// the default is app.explore
export default {
  search, preview,
  shortlist, remember, forget, toggleRemembered,
  subscribe,
  idOf, urlOf,
};
