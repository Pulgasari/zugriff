// podcasts :: views/ExploreView.js

/* === REFACTORING ===
- war auf unnötig zig files zerstreut
- das ganz modul 'explore' ist eigtl. quatsch, weil das ganze zeug lebt eh nur hier
- 
*/

// :::::: IMPORT ::::::::::::::::::::::::::::::::::::::::::::::::::::::

import { boolSignal, enumSignal, stringSignal, useSignal } from '@aufbau/signals';
import { useEffect, useRef }                               from 'preact/hooks';

// ::: shared components
import ActionMenu  from '/.shared/js/components/ActionMenu.js';
import Button      from '/.shared/js/components/Button.js';
import Date        from '/.shared/js/components/Date.js';
import Empty       from '/.shared/js/components/Empty.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import Index       from '/.shared/js/components/Index.js';
import Loading     from '/.shared/js/components/Loading.js';
import Picker      from '/.shared/js/components/Picker.js';
import SearchPanel from '/.shared/js/components/SearchPanel.js';
import View        from '/.shared/js/components/View.js';

// ::: local components
import Artwork    from './Artwork.js';

// ::: local modules
import { fetchFeed, parseFeed } from './../modules/feed.js';
import { useTable }             from './../modules/hooks.js';
import { looksLikeUrl }         from './../modules/methods.js';
import { plain }                from './../modules/methods.js';
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

// :::::: EXPLORER ::::::::::::::::::::::::::::::::::::::::::::::::::::::

// ::: helpers

const urlOf = (entry = {}) => normalizeUrl(entry.url || entry.feedUrl || '');
const  idOf = (entry = {}) => entry.id || podcastIdByHash(urlOf(entry));

const keyed = (result) => {
  const url = normalizeUrl(result.feedUrl);
  return result.kind === 'episode'
    ? { ...result, url, podcastId : podcastIdByHash(url) }
    : { ...result, url, id        : podcastIdByHash(url) };
};

// ::: api

const loadSubscribedPodcasts = useTable('podcasts',  () => app.db.podcasts.toKeys(),    ['keys']);
const loadRememberedPodcasts = useTable('shortlist', () => app.db.shortlist.toValues(), ['all']);


const explorer = {};
explorer.rememberedPodcasts = new Set (loadRememberedPodcasts?.map(row => row.id) ?? []);
explorer.subscribedPodcasts = new Set (loadSubscribedPodcasts                     ?? []);
explorer.searchEpisodes     = async (term, options) => (await searchEpisodes(term, options)).map(keyed);         
explorer.searchPodcasts     = async (term, options) => (await searchPodcasts(term, options)).map(keyed);         

// ::: state

const previews = new Map; // (temp feeds in session) url -> promise of { url, id, feed, podcast, episodes }

const state = {
  isReady :   boolSignal (loadSubscribedPodcasts && loadRememberedPodcasts),
  search  : stringSignal (''),
  tab     :   enumSignal ('podcasts', ['podcasts', 'episodes']),
};

function preview (rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return Promise.reject(new Error('no feed url'));
  if (previews.has(url)) return previews.get(url);

  const job = (async () => {
    const fetched = await fetchFeed(url);
    const feed    = parseFeed(fetched);
    return { url, id: podcastIdByHash(url), feed, ...toRecords(url,feed) };
  })();

  job.catch(() => previews.delete(url));

  previews.set(url, job);
  return job;
}

const toRow = (entry) => ({
  id      :  idOf(entry),
  url     : urlOf(entry),
  title   : entry.title  || urlOf(entry),
  author  : entry.author || '',
  image   : entry.image  || '',
  genre   : entry.genre  || '',
  count   : entry.count  ?? entry.episodeCount ?? 0,
  addedAt : Date.now(),
});

// :::::: ACTIONS ::::::::::::::::::::::::::::::::::::::::::::::::::::::::

const forget    = (entry) => app.db.shortlist.delete(idOf(entry));
const shortlist = ()      => app.db.shortlist.toValues();
const open      = (url)   => app.go('explore-podcast', url);

async function remember (entry) {
  const row = toRow(entry);
  if (!row.url) throw new Error('no feed url to remember');
  await app.db.shortlist.set(row.id, row);
  return row;
}

async function toggleRemembered (entry) {
  const id = idOf(entry);
  if (await app.db.shortlist.get(id)) { await app.db.shortlist.delete(id); return false; }
  await remember(entry);
  return true;
}

const subscribe = async (entry) => {
  if (busy.value) return;
  busy.value = true;
  try {
    const podcast = await app.explore.subscribe(entry);
    app.toast.success(`Subscribed to ${podcast.title}`);
  }
  catch (error) { app.toast.error(error); }
  finally       { busy.value = false; }
};

async function subscribe (entry) {
  const url = urlOf(entry);
  const has = previews.has(url) ? await previews.get(url).catch(() => null) : null;

  const podcast = await app.library.subscribe(url, has?.feed);
  await app.db.shortlist.delete(podcast.id);
  return podcast;
}

// :::::: SUB-COMPONENTS ::::::::::::::::::::::::::::::::::::::::::::::::::

const EmptySearch   = { icon: 'mdi:magnify-close', title: 'Nothing found',            hint: 'Try another name, another storefront, or paste a feed URL.' };
const EmptyEpisodes = { icon: 'mdi:playlist-play', title: 'Search for an episode',    hint: 'Episodes are found by title, author or description across the whole directory.' };         
const EmptyPodcasts = { icon: 'bookmark-unfilled', title: 'Nothing on the shortlist', hint: 'Search for a podcast, open it, and remember it to come back to it later.' };      

function Filter () {
  const search    = stringSignal('');
  const attribute =   enumSignal('');
  const country   =   enumSignal('');

  useEffect(() => { field.current?.focus(); }, []);
  
  return html`
    <${SearchPanel} placeholder='type to search ...' ref=${field} signal=${query}>
      <${Picker} look='combobox' placeholder='country' signal=${country} src=${COUNTRIES} searchable />
      <${Picker} look='combobox' placeholder='match …' signal=${attribute} />
    </${SearchPanel}>
  `;
}

function Tab ({ children, ...rest }) {
  return html`
    <div class='tab' ...${rest}>
      ${children}
    </div>
  `;
}

function ExploreEpisodesTab () {
  const results = useSignal([]);
  const busy    = useSignal(false);
  const note    = useSignal('');
  const field   = useRef(null);
  const text    = query.trim();
  const entries = text ? results.value : [];
  

  useEffect(() => { results.value = []; }, [tab]);
  
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreEpisodes}
        ...${{ entries, remembered, subscribed }}
        empty=${emptyEpisodes}
      />
    </${Tab}>
  `;
}

function ExplorePodcastsTab () {
  const results = useSignal([]);
  const busy    = useSignal(false);
  const note    = useSignal('');
  const field   = useRef(null);
  const text    = query.trim();
  const entries = text ? results.value : shortlist ?? [];
  

  useEffect(() => { results.value = []; }, [tab]);
  
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreIndex}
        ...${{ entries, remembered, subscribed }}
        empty=${emptyPodcasts}
        onSubscribe=${subscribe}
      />
    </${Tab}>
  `;
}

function ExploreEpisodeItem ({ author, date, description, duration, image, link, podcast, podcastId, title, url,     episode, remembered, subscribed }) {
  const open   = () => app.go('explore-podcast', url);
  const teaser = plain(description).slice(0, TEASER);

  const isRemembered = explorer.rememberedPodcasts.has(podcastId);
  const isSubscribed = explorer.subscribedPodcasts.has(podcastId);

  return html`
    <aufbau-item class:subscribed=${subscribed}>
      <${Artwork} aria-label='open podcast' onClick=${open} src=${image} />

      <div class='meta'>
        <${Date} value=${date} />
        <span class='dur'>${zugriff.fmt.duration(duration)}</span>
      </div>

      <${Button} class='title' label=${title} onClick=${open} />

      ${teaser && html`<p class='teaser'>${teaser}</p>`}

      <${ActionMenu}>
        <${SubscribeButton} entry=${entry} />
        <${RememberButton}  entry=${entry} />
        ${link && html`<${Button} href=${link} icon='mdi:open-in-new' />`}
      </${ActionMenu}>
    </aufbau-item>
  `;
}

function ExploreEpisodesIndex ({ episodes }) {
  return (!episodes.length) 
  ? html`<${Empty} ...${empty} />`
  : html`
    <${Index} viewmode='list'>
      ${episodes.map(ExploreEpisodeItem)}
    </${Index}>
  `;
}

function RememberButton ({ entry }) {
  const onClick      = () => explorer.toggleRemembered(entry);
  const isRemembered = false;
  const obj = isRemembered
    ? { icon: 'bookmark',          label: 'remembered', title: 'click to forget',   onClick }
    : { icon: 'bookmark-unfilled', label: 'remember',   title: 'click to remember', onClick };
  
  return html`<${Button} ...${obj} />`;
}

function RememberButton ({ entry }) {
  const isSubscribed = false;
  const obj = isSubscribed
    ? { icon: 'check', label: 'In library', onClick: () => app.go('podcast', entry.id) }
    : { icon: 'add',   label: 'Subscribe',  onClick: () => onSubscribe?.(entry) };
  
  return html`<${Button} ...${obj} />`;
}

function ExplorePodcastItem ({ entry, remembered, subscribed, onSubscribe }) {
  const open = () => app.go('explore-podcast', entry.url);

  const sub = [entry.author, entry.genre, entry.count ? `${entry.count} episode(s)` : '']
    .filter(Boolean)
    .join(' · ');

  return html`
    <aufbau-item class:subscribed=${subscribed}>
      <${Artwork} aria-label='open podcast' onClick=${open} src=${entry.image} />

      <div class='meta'>${sub}</div>

      <${Button} class='title' label=${entry.title} onClick=${open} />

      <${ActionMenu}>
        <${SubscribeButton} entry=${entry} />
        <${RememberButton}  entry=${entry} />
      </${ActionMenu}>
    </aufbau-item>
  `;
}

function ExplorePodcastsIndex ({ entries }) {
  return (!entries.length)
  : html`<${Empty} ...${empty} />`
  : html`
    <${Index} viewmode='list'>
      ${entries.map(ExplorePodcastItem)}
    </${Index}>
  `;
}


// :::::: MAIN COMPONENT ::::::::::::::::::::::::::::::::::::::::::::::::

function ExploreView () {
  
  return html`
    <${View} id|title='explore'>
      <main>
        <${Picker} class='tabs' look='segments' signal=${state.tab} />

        ${(tab === 'episodes') ? html`<${ExploreEpisodesTab}/>` 
                               : html`<${ExplorePodcastsTab}/>`}

        ${isUrl      && html`<${Button} icon='rss' label='Open this feed' onClick=${() => open(text)} />`}
        ${note.value && html`<i class='note'>${note.value}</i>`}
        ${busy.value && html`<${Loading} text='searching …' />`}
      </main>
    </${View}>
  `;
}

export default ExploreView;
