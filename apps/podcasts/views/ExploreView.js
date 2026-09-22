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
const ready         = subscribedIds && shortlist;
const subscribed    = new Set(subscribedIds ?? []);
const remembered    = new Set(shortlist?.map(row => row.id) ?? []);

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
  const isUrl   = looksLikeUrl(text);
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

// :::::: MAIN COMPONENT

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
