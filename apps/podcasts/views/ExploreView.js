// podcasts :: views/ExploreView.js
//
// looking around before committing. the add dialog subscribes on the first click,
// which is the wrong move when the whole point is that you do not know yet: here a
// hit opens the podcast, and what it is worth is decided after reading it.
//
// two tabs over the same query: podcasts and single episodes, which is `entity` in
// the directory's terms. next to them the two filters that decide what a search even
// looks at — the storefront (`country`, and with it the language of what comes back)
// and the field the term is matched against (`attribute`).
//
// with no query the podcasts tab is the shortlist — the ones an earlier look set aside.

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
const DEBOUNCE  = 300;
const COUNTRIES = '/.shared/json/countries.json';
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

// :::::: SUB-COMPONENTS

function Filter () {
  const search    = stringSignal('');
  const attribute =   enumSignal('');
  const country   =   enumSignal('');
  
  return html`
    <${SearchPanel} placeholder='type to search ...' ref=${field} signal=${query}>
      <${Picker} look='combobox' placeholder='country' signal=${country} src=${COUNTRIES} searchable />
      <${Picker} look='combobox' placeholder='match …' signsl=${attribute} />
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
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreEpisodes}
        episodes=${entries}
        remembered=${remembered}
        subscribed=${subscribed}
        empty=${empty}
      />
    </${Tab}>
  `;
}

function ExplorePodcastsTab () {
  return html`
    <${Tab}>
      <${Filter}/>
      
      <${ExploreIndex}
        entries=${entries}
        remembered=${remembered}
        subscribed=${subscribed}
        empty=${empty}
        onSubscribe=${subscribe}
      />
    </${Tab}>
  `;
}

// :::::: MAIN COMPONENT

function ExploreView () {
  const query   = app.state.$exploreQuery;
  const tab     = app.state.$exploreTab;
  const results = useSignal([]);
  const busy    = useSignal(false);
  const note    = useSignal('');
  const field   = useRef(null);

  // the view is mounted by a click, not by a page load, and `autofocus` only
  // applies to what the parser sees — so the field takes the caret itself
  useEffect(() => { field.current?.focus(); }, []);

  // the two tables a row is read against: what is already subscribed, and what an
  // earlier visit put on the shortlist
  const subscribedIds = useTable('podcasts',  () => app.db.podcasts.toKeys(),    ['keys']);
  const shortlist     = useTable('shortlist', () => app.db.shortlist.toValues(), ['all']);

  // podcast hits and episode hits are different shapes, so the list cannot keep the
  // old tab's rows while the new tab's request is still on the wire
  useEffect(() => { results.value = []; }, [tab]);

  const text      = query.trim();
  const isUrl     = looksLikeUrl(text);
  const country   = app.state.$exploreCountry;
  const attribute = app.state.$exploreAttribute;

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

  const open = (url) => app.go('explore-podcast', url);

  const subscribe = async (entry) => {
    if (busy.value) return;
    busy.value = true;
    try {
      const podcast = await app.explore.subscribe(entry);
      app.toast.success(`Subscribed to ${podcast.title}`);
      app.go('podcast', podcast.id);
    }
    catch (error) { app.toast.error(error); }
    finally       { busy.value = false; }
  };

  // podcasts fall back to the shortlist with no query; episodes have nothing to
  // stand in for them, so that tab says what to do instead
  const onEpisodes = tab === 'episodes';
  const entries    = text ? results.value : (onEpisodes ? [] : shortlist ?? []);

  const empty = text
    ? { icon: 'mdi:magnify-close', title: 'Nothing found', hint: 'Try another name, another storefront, or paste a feed URL.' }
    : onEpisodes
    ? { icon: 'mdi:playlist-play', title: 'Search for an episode', hint: 'Episodes are found by title, author or description across the whole directory.' }
    : {
        icon  : 'bookmark-unfilled',
        title : 'Nothing on the shortlist',
        hint  : 'Search for a podcast, open it, and remember it to come back to it later.',
      };

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
