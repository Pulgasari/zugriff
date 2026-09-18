// apps/podcasts/dialogs/AddPodcastDialog.js
// one field for both ways in: type a name to search Apple's directory, or paste a
// feed url to subscribe to it directly. what you typed decides which it is.

import { useSignal } from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

import Loading from '/.shared/js/components/Loading.js';
import Modal   from '/.shared/js/components/Modal.js';

import Artwork            from './../components/Artwork.js';
import { searchPodcasts } from './../modules/search.js';

const app = zugriff.app;

const DEBOUNCE = 300;

// a url is what you paste, a name is what you type: a scheme, or no whitespace and
// a dot followed by a tld.
const looksLikeUrl = (text) =>
     /^(https?|feed|podcast):\/\//i.test(text)
  || (!/\s/.test(text) && /\.[a-z]{2,}(\/|$)/i.test(text));

export default function AddPodcastDialog () {
  const query   = useSignal('');
  const results = useSignal([]);
  const busy    = useSignal(false);
  const note    = useSignal('');

  const close = () => app.state.dialog = null;

  // search-as-you-type: the timer waits out the typing, the controller drops a
  // request whose query has already moved on
  useEffect(() => {
    const text = query.value.trim();
    note.value = '';

    if (!text || looksLikeUrl(text)) { results.value = []; return; }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      busy.value = true;
      try {
        results.value = await searchPodcasts(text, { signal: controller.signal });
        if (!results.value.length) note.value = 'nothing found for that name';
      }
      catch (error) { if (error.name !== 'AbortError') note.value = error.message; }
      finally       { if (!controller.signal.aborted) busy.value = false; }
    }, DEBOUNCE);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query.value]);

  const add = async (url) => {
    if (!url || busy.value) return;
    busy.value = true;
    try {
      const podcast = await app.library.subscribe(url);
      app.toast.success(`Subscribed to ${podcast.title}`);
      close();
      app.go('podcast', podcast.id);
    }
    // the dialog stays open on a failure, so the url can be corrected rather than retyped
    catch (error) { app.toast.error(error); note.value = error?.message || String(error); }
    finally       { busy.value = false; }
  };

  const submit = () => {
    const text = query.value.trim();
    if (looksLikeUrl(text)) add(text);
  };

  const actions = [
    { label: 'cancel', onClick: close },
  ];

  return html`
    <${Modal}
      headline='Add a podcast'
      info='Search by name, or paste an RSS feed URL.'
      actions=${actions}
      onClose=${close}
      class='add-podcast'
      >
      <input
        type='search'
        autofocus
        placeholder='darknet diaries — or https://example.com/feed.xml'
        value=${query.value}
        onInput=${e => query.value = e.target.value}
        onKeyDown=${e => { if (e.key === 'Enter') submit(); }}
        />

      ${note.value && html`<i class='note'>${note.value}</i>`}
      ${busy.value && html`<${Loading} text='searching …' />`}

      ${results.value.length > 0 && html`
        <ul class='results'>
          ${results.value.map(result => html`
            <li key=${result.id}>
              <button onClick=${() => add(result.feedUrl)} disabled=${busy.value}>
                <${Artwork} src=${result.image} />
                <span class='meta'>
                  <span class='title'>${result.title}</span>
                  <span class='sub'>${result.author}${result.count ? ` · ${result.count} episodes` : ''}</span>
                </span>
              </button>
            </li>
          `)}
        </ul>`}
    <//>
  `;
}
