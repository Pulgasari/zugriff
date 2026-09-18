// podcasts :: modules/database.js
// REBUILD

// storage layer. one @bunker/db (indexeddb) is the durable store;
// three reactive maps mirror it so the ui stays live.
// the public surface is `default` (app.db):
// two collections + a handful of actions, all reactive without touching .value.

//   podcasts  id                   -> podcast record
//   episodes  `${podcastId}:${h}`  -> episode record   (prefix-scannable per podcast)
//   state     episodeId            -> { position, done, saved, ... }

// :::::: IMPORTS

import { createDB }             from '@bunker/db';
import { fetchFeed, parseFeed } from './feed.js';
import { hash }                 from './methods.js';

// :::::: CONSTANTS

const URL_PROXY_IMG = 'https://img.pulgasari.dev/?url={url}&w={w}';
const URL_PROXY_RSS = 'https://api.allorigins.win/raw?url={url}';

// :::::: 

const database = createDb('zugriff:podcasts');
await database.setup({ episodes: {}, podcasts: {} });


const deletePodcast = id => await store.podcasts.delete(pid);

const getEpisode  = async (id) => await database.episodes.get({ id });
const getPodcast  = async (id) => await database.podcasts.get({ id });

const getEpisodes = async ()   => await database.episodes.getAll ();
const getPodcasts = async ()   => await database.podcasts.getAll ();

const setEpisode = async (id, body) => await database.episodes.set (id, body);
const setPodcast = async (id, body) => await database.podcasts.set (id, body);

const createHashedEpisodeId = (pid, guid) => `${pid}:${hash(guid)}`;
const createHashedPodcastId = (url)       => 'p' + hash(url);


// ── ids ──
// cyrb53: a short, stable base-36 hash, so long urls/guids stay out of the keys.
// same input -> same id, which is what lets progress survive a re-fetch.


