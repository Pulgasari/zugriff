// podcasts :: modules/database.js
//
// the store. three tables over @bunker/db (indexeddb) and nothing else: no app
// state, no fetching, no rules about what a record means. library.js is what puts
// records in and takes them out.
//
//   podcasts  id                   -> podcast record
//   episodes  `${podcastId}:${h}`  -> episode record
//   progress  episodeId            -> { position, duration, done, saved, … }
//
// keys are strings and indexeddb sorts them lexicographically, so prefixing an
// episode's key with its podcast id makes "everything of this podcast" a plain
// range scan — no secondary index.

// :::::: IMPORTS

import { createDb } from '@bunker/db';
import { hash }     from './methods.js';

// :::::: DB

const database = createDb('zugriff:podcasts');

// :::::: IDS
// cyrb53 (methods.js): a short, stable base-36 hash, so long urls and guids stay
// out of the keys. same input -> same id, which is what lets listening progress
// survive a re-fetch.

const podcastId = (url)       => 'p' + hash(url);
const episodeId = (pid, guid) => `${pid}:${hash(guid)}`;

// :::::: SCHEMA
// all three tables in ONE upgrade. touching a table that does not exist yet
// triggers its own lazy upgrade, and three of those race on a cold db.
// setup() is a no-op from the second call on.

const setup = () => database.setup({ podcasts: {}, episodes: {}, progress: {} });

// :::::: READ

const getPodcasts = () => database.podcasts.toValues();
const getEpisodes = () => database.episodes.toValues();
const getProgress = () => database.progress.toMap();

const getPodcast  = (id) => database.podcasts.get(id);
const getEpisode  = (id) => database.episodes.get(id);

// :::::: WRITE
// the batch forms take [key, value] entries and settle in one transaction —
// a call per record would open one each.

const put  = (table, entries) => database.task(table, 'readwrite', os => { for (const [id, value] of entries) os.put(value, id); });
const drop = (table, ids)     => database.task(table, 'readwrite', os => { for (const id of ids) os.delete(id); });

const setPodcast  = (id, record) => database.podcasts.set(id, record);
const setProgress = (id, record) => database.progress.set(id, record);

const putEpisodes = (entries) => put('episodes', entries);
const putProgress = (entries) => put('progress', entries);

const deletePodcast  = (id)  => database.podcasts.delete(id);
const deleteEpisodes = (ids) => drop('episodes', ids);
const deleteProgress = (ids) => drop('progress', ids);

// :::::: EXPORT

export {
  database, setup,
  podcastId, episodeId,
  getPodcast, getPodcasts, getEpisode, getEpisodes, getProgress,
  setPodcast, setProgress, putEpisodes, putProgress,
  deletePodcast, deleteEpisodes, deleteProgress,
};

export default database;
