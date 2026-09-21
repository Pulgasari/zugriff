// podcasts :: views/ExploreView.js
//
// looking around before committing. the add dialog subscribes on the first click,
// which is the wrong move when the whole point is that you do not know yet: here a
// hit opens the podcast, and what it is worth is decided after reading it.
//
// with no query the view is the shortlist — the podcasts an earlier look put aside.

import { useSignal }        from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';

import Button      from '/.shared/js/components/Button.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import Loading     from '/.shared/js/components/Loading.js';
import View        from '/.shared/js/components/View.js';

import ExploreIndex from './../components/ExploreIndex.js';

import { useTable }     from './../modules/hooks.js';
import { looksLikeUrl } from './../modules/methods.js';

const app      = zugriff.app;
const DEBOUNCE = 300;

export default function ExploreView () {
  const query   = app.state.$exploreQuery;
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

  const text = query.trim();
  const isUrl = looksLikeUrl(text);

  // search-as-you-type: the timer waits out the typing, the controller drops a
  // request whose query has already moved on. a url is not searched for — it is the
  // feed itself, and enter opens it.
  useEffect(() => {
    note.value = '';
    if (!text || isUrl) { results.value = []; busy.value = false; return; }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      busy.value = true;
      try {
        results.value = await app.explore.search(text, { signal: controller.signal });
        if (!results.value.length) note.value = 'nothing found for that name';
      }
      catch (error) { if (error.name !== 'AbortError') note.value = error.message; }
      finally       { if (!controller.signal.aborted) busy.value = false; }
    }, DEBOUNCE);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [text]);

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

  const entries = text ? results.value : (shortlist ?? []);

  const empty = text
    ? { icon: 'mdi:magnify-close', title: 'Nothing found', hint: 'Try another name, or paste a feed URL.' }
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
        <input
          ref=${field}
          type='search'
          placeholder='darknet diaries — or https://example.com/feed.xml'
          value=${query}
          onInput=${event => app.state.exploreQuery = event.target.value}
          onKeyDown=${event => { if (event.key === 'Enter' && isUrl) open(text); }}
          />

        ${isUrl && html`
          <${Button} icon='rss' label='Open this feed' onClick=${() => open(text)} />`}

        ${note.value && html`<i class='note'>${note.value}</i>`}
        ${busy.value && html`<${Loading} text='searching …' />`}

        ${!text && !isUrl && html`<div class='section'><span>Shortlist</span></div>`}

        ${ready && !isUrl && html`
          <${ExploreIndex}
            entries=${entries}
            remembered=${remembered}
            subscribed=${subscribed}
            empty=${empty}
            onSubscribe=${subscribe}
            />`}
      </main>
    </${View}>
  `;
}
