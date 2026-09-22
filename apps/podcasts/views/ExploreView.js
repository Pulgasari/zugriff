// podcasts :: views/ExploreView.js

import { enumSignal, stringSignal, useSignal } from '@aufbau/signals';
import { useEffect, useRef }     from 'preact/hooks';

import Button      from '/.shared/js/components/Button.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import Loading     from '/.shared/js/components/Loading.js';
import Picker      from '/.shared/js/components/Picker.js';
import SearchPanel from '/.shared/js/components/SearchPanel.js';
import View        from '/.shared/js/components/View.js';

import ExploreEpisodesIndex from './../components/ExploreEpisodesIndex.js';
import ExplorePodcastsIndex from './../components/ExplorePodcastsIndex.js';

import { useTable }     from './../modules/hooks.js';
import { looksLikeUrl } from './../modules/methods.js';

const app       = zugriff.app;
const COUNTRIES = '/.shared/json/countries.json';
const DEBOUNCE  = 300;
const TABS      = [
  { value: 'podcasts', label: 'podcasts', icon: 'mdi:podcast'       },
  { value: 'episodes', label: 'episodes', icon: 'mdi:playlist-play' },
];

const state = {
  filter : {
    
  },
  search : stringSignal(''),
  tab    :   enumSignal('podcasts', ['podcasts', 'episodes']),
};

// :::::: ACTIONS

const open = (url) => app.go('explore-podcast', url);

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

// :::::: SUB-COMPONENTS

const subscribedIds = useTable('podcasts',  () => app.db.podcasts.toKeys(),    ['keys']);
const shortlist     = useTable('shortlist', () => app.db.shortlist.toValues(), ['all']);

const emptySearch   = { icon: 'mdi:magnify-close', title: 'Nothing found',            hint: 'Try another name, another storefront, or paste a feed URL.' };
const emptyEpisodes = { icon: 'mdi:playlist-play', title: 'Search for an episode',    hint: 'Episodes are found by title, author or description across the whole directory.' };         
const emptyPodcasts = { icon: 'bookmark-unfilled', title: 'Nothing on the shortlist', hint: 'Search for a podcast, open it, and remember it to come back to it later.' };      

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
  const isUrl   = looksLikeUrl(text);

  useEffect(() => { results.value = []; }, [tab]);
  
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreEpisodes}
        episodes=${entries}
        remembered=${remembered}
        subscribed=${subscribed}
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
  const isUrl   = looksLikeUrl(text);

  useEffect(() => { results.value = []; }, [tab]);
  
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreIndex}
        entries=${entries}
        remembered=${remembered}
        subscribed=${subscribed}
        empty=${emptyPodcasts}
        onSubscribe=${subscribe}
      />
    </${Tab}>
  `;
}

// :::::: MAIN COMPONENT

function ExploreView () {
  // search-as-you-type: the timer waits out the typing, the controller drops a
  // request whose query has already moved on. changing tab or filter re-runs it,
  // since every one of them is part of the question. a url is not searched for — it
  // is the feed itself, and enter opens it.
  useEffect(() => {
    note.value = '';
    if (!text || isUrl) { results.value = []; busy.value = false; return; }

    const controller = new AbortController();
    const search     = tab === 'episodes' ? app.explore.episodes : app.explore.search;

    const timer = setTimeout(async () => {
      busy.value = true;
      try {
        results.value = await search(text, { country, attribute, signal: controller.signal });
        if (!results.value.length) note.value = 'nothing found for that';
      }
      catch (error) { if (error.name !== 'AbortError') note.value = error.message; }
      finally       { if (!controller.signal.aborted) busy.value = false; }
    }, DEBOUNCE);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, tab, country, attribute]);

  // the frame renders before the tables are in — the field is what this view is
  // for, and it should not wait on a db read to take the caret
  const ready      = subscribedIds && shortlist;
  const subscribed = new Set(subscribedIds ?? []);
  const remembered = new Set(shortlist?.map(row => row.id) ?? []);

  

  

  // podcasts fall back to the shortlist with no query; episodes have nothing to
  // stand in for them, so that tab says what to do instead
  const onEpisodes = tab === 'episodes';
  const entries    = text ? results.value : (onEpisodes ? [] : shortlist ?? []);

  

  return html`
    <${View} class='explore-view' id='explore'>
      <header>
        <h1>Explore</h1>
        <div class='view-tools'>
          <${IconButton} icon='add' label='Add by URL' onClick=${() => app.state.dialog = 'add'} />
        </div>
      </header>

      <main>
        <${Picker}
          class='tabs'
          look='segments'
          options=${TABS}
          value=${tab}
          onChange=${value => app.state.exploreTab = value}
          />

        ${onEpisodes ? html`<${ExploreEpisodesTab}/>` 
                     : html`<${ExplorePodcastsTab}/>`}
        

        ${isUrl && html`
          <${Button} icon='rss' label='Open this feed' onClick=${() => open(text)} />`}

        ${note.value && html`<i class='note'>${note.value}</i>`}
        ${busy.value && html`<${Loading} text='searching …' />`}

        ${!text && !isUrl && !onEpisodes && html`<div class='section'><span>Shortlist</span></div>`}
        ${ready && !isUrl && (onEpisodes ? html`` : html``)}
      </main>
    </${View}>
  `;
}

export default ExploreView;
