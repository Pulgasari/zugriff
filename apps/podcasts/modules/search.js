// podcasts :: modules/search.js
//
// finding a feed by name, through Apple's iTunes Search API. no key, no account,
// and every podcast in their directory carries the feed url we actually subscribe
// to — which is the only field here we truly need.
//
// whether apple sends CORS headers has a habit of changing, so this takes the same
// route feed.js does: direct first, then through the configured proxy.

// :::::: IMPORTS

import { viaProxy } from './feed.js';

// :::::: CONSTANTS

const ENDPOINT = 'https://itunes.apple.com/search';

// :::::: FETCH

async function getJson (url, signal) {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// :::::: MAIN

// one result, thinned to what a row shows and what subscribing needs. an entry
// without a feed url is nothing to subscribe to, the same way an episode without
// audio is nothing to play.
const toResult = (item) => ({
  id      : String(item.collectionId ?? item.feedUrl),
  title   : item.collectionName || item.trackName || '',
  author  : item.artistName     || '',
  feedUrl : item.feedUrl        || '',
  image   : item.artworkUrl600  || item.artworkUrl100 || '',
  count   : item.trackCount     || 0,
  genre   : item.primaryGenreName || '',
});

/**
 * search the directory by name. `signal` aborts an in-flight request, which is how
 * search-as-you-type drops a result its query has already moved past.
 */
export async function searchPodcasts (term, { limit = 25, signal } = {}) {
  const text = (term || '').trim();
  if (!text) return [];

  const query = new URLSearchParams({ media: 'podcast', entity: 'podcast', term: text, limit });
  const url   = `${ENDPOINT}?${query}`;

  let data;
  try         { data = await getJson(url, signal); }
  catch (error) {
    if (error.name === 'AbortError') throw error;       // the caller moved on, not a failure
    try         { data = await getJson(viaProxy(url), signal); }
    catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(`could not reach the podcast directory (${err.message})`);
    }
  }

  return (data?.results || []).map(toResult).filter(result => result.feedUrl);
}

export default searchPodcasts;
