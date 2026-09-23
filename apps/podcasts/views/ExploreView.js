// podcasts :: views/ExploreView.js
//
// looking around before committing: a hit opens the podcast instead of subscribing
// to it. two tabs over one query (podcasts, single episodes) and two filters that
// decide what is searched at all: the storefront (`country`) and the field the term
// is matched against (`attribute`). with no query the podcasts tab is the shortlist.
//
// everything explore needs lives here. ExplorePodcastView imports the few pieces it
// shares (preview, subscribe, toggleRemembered) from this file.

// :::::: IMPORT ::::::::::::::::::::::::::::::::::::::::::::::::::::::

import { local, signalStore, useSignal } from '@aufbau/signals';
import { useEffect }                     from 'preact/hooks';

// ::: shared components
import ActionMenu  from '/.shared/js/components/ActionMenu.js';
import Button      from '/.shared/js/components/Button.js';
import DateLabel   from '/.shared/js/components/Date.js';
import Empty       from '/.shared/js/components/Empty.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import Index       from '/.shared/js/components/Index.js';
import Loading     from '/.shared/js/components/Loading.js';
import Picker      from '/.shared/js/components/Picker.js';
import SearchPanel from '/.shared/js/components/SearchPanel.js';
import View        from '/.shared/js/components/View.js';

// ::: local components
import Artwork from './../components/Artwork.js';

// ::: local modules
import { fetchFeed, parseFeed }                     from './../modules/feed.js';
import { useTable }                                 from './../modules/hooks.js';
import { looksLikeUrl, plain }                      from './../modules/methods.js';
import { normalizeUrl, podcastIdByHash, toRecords } from './../modules/library.js';
import { ANY, ATTRIBUTES, localCountry }            from './../modules/search.js';
import { searchEpisodes, searchPodcasts }           from './../modules/search.js';

// :::::: CONSTANTS ::::::::::::::::::::::::::::::::::::::::::::::::::::

const app       = zugriff.app;
const COUNTRIES = '/.shared/json/countries.json';
const DEBOUNCE  = 300;
const TEASER    = 200;
const TABS      = [
  { value: 'podcasts', label: 'podcasts', icon: 'mdi:podcast'       },
  { value: 'episodes', label: 'episodes', icon: 'mdi:playlist-play' },
];

const EMPTY = {
  search   : { icon: 'mdi:magnify-close', title: 'Nothing found',            hint: 'Try another name, another storefront, or paste a feed URL.' },
  episodes : { icon: 'mdi:playlist-play', title: 'Search for an episode',    hint: 'Episodes are found by title, author or description across the whole directory.' },
  podcasts : { icon: 'bookmark-unfilled', title: 'Nothing on the shortlist', hint: 'Search for a podcast, open it, and remember it to come back to it later.' },
};

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// module scope, so query and tab survive leaving the view and coming back.
// storefront and field are preferences and persist; query and tab do not.

const state = signalStore({
  query     : { type: String, value: '' },
  tab       : { type: 'enum', values: TABS.map(tab => tab.value), value: 'podcasts' },
  country   : { type: String, value: localCountry() },
  attribute : { type: 'enum', values: ATTRIBUTES.map(option => option.value), value: ANY },
}, { key: 'podcasts:explore:', store: local, persist: ['country', 'attribute'] });

// :::::: HELPERS ::::::::::::::::::::::::::::::::::::::::::::::::::::::
// a directory hit, a shortlist row and a preview describe the same podcast; the
// feed url and our own id derived from it are what they share.

const urlOf = (entry = {}) => normalizeUrl(entry.url || entry.feedUrl || '');
const idOf  = (entry = {}) => entry.id || podcastIdByHash(urlOf(entry));

// replaces the directory's id with ours, so "subscribed" / "remembered" are plain
// set lookups. an episode hit is keyed by its podcast.
const keyed = (result) => {
  const url = normalizeUrl(result.feedUrl);
  return result.kind === 'episode'
    ? { ...result, url, podcastId: podcastIdByHash(url) }
    : { ...result, url, id: podcastIdByHash(url) };
};

// the podcast an episode hit belongs to, in the shape the row actions expect
const podcastOf = (episode) => ({
  id     : episode.podcastId,
  url    : episode.url,
  title  : episode.podcast,
  author : episode.author,
  image  : episode.image,
});

// what a shortlist row keeps: enough for a list, plus the url back to the feed
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

// :::::: ACTIONS ::::::::::::::::::::::::::::::::::::::::::::::::::::::

// feeds read but not stored, cached per url for the session.
// url -> promise of { url, id, feed, podcast, episodes }
const previews = new Map;

/** read a feed without subscribing to it */
function preview (rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return Promise.reject(new Error('no feed url'));
  if (previews.has(url)) return previews.get(url);

  const job = (async () => {
    const feed = parseFeed(await fetchFeed(url));
    return { url, id: podcastIdByHash(url), feed, ...toRecords(url, feed) };
  })();

  // a failed fetch must not be handed back to every later visit
  job.catch(() => previews.delete(url));

  previews.set(url, job);
  return job;
}

/** returns whether the podcast is on the shortlist afterwards */
async function toggleRemembered (entry) {
  const row = toRow(entry);
  if (await app.db.shortlist.get(row.id)) { await app.db.shortlist.delete(row.id); return false; }
  if (!row.url) throw new Error('no feed url to remember');
  await app.db.shortlist.set(row.id, row);
  return true;
}

/** reuses an already previewed feed and drops the shortlist row */
async function subscribe (entry) {
  const url     = urlOf(entry);
  const cached  = previews.has(url) ? await previews.get(url).catch(() => null) : null;
  const podcast = await app.library.subscribe(url, cached?.feed);
  await app.db.shortlist.delete(podcast.id);
  return podcast;
}

async function subscribeAndOpen (entry) {
  try {
    const podcast = await subscribe(entry);
    app.toast.success(`Subscribed to ${podcast.title}`);
    app.go('podcast', podcast.id);
  }
  catch (error) { app.toast.error(error); }
}

const open = (url) => app.go('explore-podcast', url);

// row actions as ActionMenu specs. `podcast` is always podcast-shaped (see podcastOf).
const rememberAction = (podcast, isRemembered) => isRemembered
  ? { icon: 'bookmark',          label: 'Forget',   title: 'Remove from the shortlist',    onClick: () => toggleRemembered(podcast) }
  : { icon: 'bookmark-unfilled', label: 'Remember', title: 'Keep for a closer look later', onClick: () => toggleRemembered(podcast) };

const subscribeAction = (podcast, isSubscribed) => isSubscribed
  ? { icon: 'check', label: 'In library', onClick: () => app.go('podcast', podcast.id) }
  : { icon: 'add',   label: 'Subscribe',  onClick: () => subscribeAndOpen(podcast) };

// :::::: SUB-COMPONENTS :::::::::::::::::::::::::::::::::::::::::::::::

function PodcastItem ({ entry, isRemembered, isSubscribed }) {
  const meta = [entry.author, entry.genre, entry.count ? `${entry.count} episode(s)` : '']
    .filter(Boolean)
    .join(' · ');

  return html`
    <aufbau-item class:subscribed=${isSubscribed}>
      <${Artwork} aria-label='open podcast' onClick=${() => open(entry.url)} src=${entry.image} />
      <div class='meta'>${meta}</div>
      <${Button} class='title' label=${entry.title} onClick=${() => open(entry.url)} />
      <${ActionMenu} items=${[
        rememberAction (entry, isRemembered),
        subscribeAction(entry, isSubscribed),
      ]} />
    </aufbau-item>
  `;
}

function EpisodeItem ({ entry, isRemembered, isSubscribed }) {
  const podcast = podcastOf(entry);
  const teaser  = plain(entry.description).slice(0, TEASER);

  return html`
    <aufbau-item class:subscribed=${isSubscribed}>
      <${Artwork} aria-label='open podcast' onClick=${() => open(entry.url)} src=${entry.image} />
      <div class='meta'>
        <${DateLabel} value=${entry.date} />
        <span class='dur'>${zugriff.fmt.duration(entry.duration)}</span>
      </div>
      <${Button} class='title' label=${entry.title} onClick=${() => open(entry.url)} />
      ${teaser && html`<p class='teaser'>${teaser}</p>`}
      <${ActionMenu} items=${[
        rememberAction (podcast, isRemembered),
        subscribeAction(podcast, isSubscribed),
        // an empty href would render a link that goes nowhere
        entry.link && { icon: 'mdi:open-in-new', href: entry.link, title: 'open the episode in the store' },
      ].filter(Boolean)} />
    </aufbau-item>
  `;
}

function Results ({ tab, entries, empty, remembered, subscribed }) {
  if (!entries.length) return html`<${Empty} ...${empty} />`;

  const isEpisodes = tab === 'episodes';
  const Item       = isEpisodes ? EpisodeItem : PodcastItem;
  const podcastId  = isEpisodes ? (entry => entry.podcastId) : (entry => entry.id);

  return html`
    <${Index} class=${isEpisodes ? 'explore-episodes' : undefined} viewmode='list'>
      ${entries.map(entry => html`
        <${Item}
          key=${entry.id}
          entry=${entry}
          isRemembered=${remembered.has(podcastId(entry))}
          isSubscribed=${subscribed.has(podcastId(entry))}
          />
      `)}
    </${Index}>
  `;
}

// :::::: MAIN COMPONENT :::::::::::::::::::::::::::::::::::::::::::::::

function ExploreView () {
  const results = useSignal([]);
  const busy    = useSignal(false);
  const note    = useSignal('');

  const subscribedIds = useTable('podcasts',  () => app.db.podcasts.toKeys(),    ['keys']);
  const shortlist     = useTable('shortlist', () => app.db.shortlist.toValues(), ['all']);

  const { $tab: tab, $country: country, $attribute: attribute } = state;
  const text  = state.$query.trim();
  const isUrl = looksLikeUrl(text);

  // podcast hits and episode hits are different shapes: the old tab's rows must not
  // stay on screen while the new tab's request is on the wire
  useEffect(() => { results.value = []; }, [tab]);

  // search-as-you-type. the timer waits out the typing, the controller drops a
  // request whose query has moved on. a url is not searched — it is the feed itself.
  useEffect(() => {
    note.value = '';
    if (!text || isUrl) { results.value = []; busy.value = false; return; }

    const controller = new AbortController();
    const search     = tab === 'episodes' ? searchEpisodes : searchPodcasts;

    const timer = setTimeout(async () => {
      busy.value = true;
      try {
        results.value = (await search(text, { country, attribute, signal: controller.signal })).map(keyed);
        if (!results.value.length) note.value = 'nothing found for that';
      }
      catch (error) { if (error.name !== 'AbortError') note.value = error.message; }
      finally       { if (!controller.signal.aborted) busy.value = false; }
    }, DEBOUNCE);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, tab, country, attribute]);

  // the frame renders before the tables are in; only the list waits for them
  const isReady    = subscribedIds && shortlist;
  const subscribed = new Set(subscribedIds ?? []);
  const remembered = new Set(shortlist?.map(row => row.id) ?? []);

  // with no query: podcasts fall back to the shortlist, episodes have nothing to show
  const entries = text ? results.value : (tab === 'podcasts' ? shortlist ?? [] : []);
  const empty   = text ? EMPTY.search  : EMPTY[tab];

  const tools = html`<${IconButton} icon='add' label='Add by URL' onClick=${() => app.state.dialog = 'add'} />`;

  return html`
    <${View} class='explore-view' id='explore' title='Explore' tools=${tools}>
      <main>
        <${Picker} class='tabs' look='segments' options=${TABS} sig=${state.tab} />

        <${SearchPanel} placeholder='darknet diaries — or https://example.com/feed.xml' signal=${state.query} />

        <div class='filters'>
          <${Picker} class='country'   look='combobox' placeholder='storefront …' sig=${state.country} src=${COUNTRIES} searchable />
          <${Picker} class='attribute' look='combobox' placeholder='match …'      sig=${state.attribute} options=${ATTRIBUTES} />
        </div>

        ${isUrl      && html`<${Button} icon='rss' label='Open this feed' onClick=${() => open(text)} />`}
        ${note.value && html`<i class='note'>${note.value}</i>`}
        ${busy.value && html`<${Loading} text='searching …' />`}

        ${!text && tab === 'podcasts' && html`<div class='section'><span>Shortlist</span></div>`}

        ${isReady && !isUrl && html`
          <${Results} ...${{ tab, entries, empty, remembered, subscribed }} />
        `}
      </main>
    </${View}>
  `;
}

// :::::: EXPORT :::::::::::::::::::::::::::::::::::::::::::::::::::::::

export { preview, subscribe, toggleRemembered };
export default ExploreView;
