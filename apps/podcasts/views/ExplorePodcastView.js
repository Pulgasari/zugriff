// podcasts :: views/ExplorePodcastView.js
//
// one podcast, read straight from its feed and stored nowhere: what it is, who makes
// it, and every episode it publishes — enough to decide whether it is worth a
// subscription, which is the decision the explore view exists for.
//
// the route carries the feed url, not an id. a preview has no record to point at, and
// the url is the one thing that still means something after a reload.

import { useSignal } from '@aufbau/signals';
import { useEffect } from 'preact/hooks';

import Button       from '/.shared/js/components/Button.js';
import Empty        from '/.shared/js/components/Empty.js';
import GoBackButton from '/.shared/js/components/GoBackButton.js';
import Link         from '/.shared/js/components/Link.js';
import Loading      from '/.shared/js/components/Loading.js';
import View         from '/.shared/js/components/View.js';

import Artwork         from './../components/Artwork.js';
import PreviewEpisodes from './../components/PreviewEpisodes.js';

import { useTable }                 from './../modules/hooks.js';

import { preview, subscribe as subscribeTo, toggleRemembered } from './ExploreView.js';
import { paragraphs, sortEpisodes } from './../modules/methods.js';

const app = zugriff.app;

export default function ExplorePodcastView ({ id: url }) {
  const data  = useSignal(null);   // { id, feed, podcast, episodes }
  const error = useSignal('');
  const busy  = useSignal(false);

  const subscribedIds = useTable('podcasts',  () => app.db.podcasts.toKeys(),    ['keys']);
  const shortlist     = useTable('shortlist', () => app.db.shortlist.toValues(), ['all']);

  useEffect(() => {
    let alive = true;
    data.value = null;
    error.value = '';

    preview(url)
      .then (result => { if (alive) data.value  = result; })
      .catch(err    => { if (alive) error.value = err?.message || String(err); });

    return () => { alive = false; };
  }, [url]);

  const back = html`<${GoBackButton} go='explore' />`;

  if (error.value) return html`
    <${View} class='explore-podcast-view'>
      <header>${back}<h1>Explore</h1></header>
      <${Empty} icon='alert' title='could not read that feed' hint=${error.value} />
    </${View}>`;

  if (!data.value || !subscribedIds || !shortlist) return html`
    <${View} class='explore-podcast-view'>
      <header>${back}<h1>Explore</h1></header>
      <${Loading} text='reading the feed …' />
    </${View}>`;

  const { podcast, episodes } = data.value;
  const subscribed = subscribedIds.includes(podcast.id);
  const remembered = shortlist.some(row => row.id === podcast.id);
  const paras      = paragraphs(podcast.description);
  const sorted     = sortEpisodes(episodes, 'newest');

  const subscribe = async () => {
    if (busy.value) return;
    busy.value = true;
    try {
      await subscribeTo({ id: podcast.id, url });
      app.toast.success(`Subscribed to ${podcast.title}`);
      app.go('podcast', podcast.id);
    }
    catch (err) { app.toast.error(err); }
    finally     { busy.value = false; }
  };

  // the shortlist row is written from the feed, so it survives a directory that has
  // never heard of this podcast — pasting a feed url is a way in here too.
  const remember = () => toggleRemembered({
    id     : podcast.id,
    url,
    title  : podcast.title,
    author : podcast.author,
    image  : podcast.image,
    count  : podcast.episodeCount,
  });

  return html`
    <${View} class='explore-podcast-view' id='explore-podcast'>
      <header>
        ${back}
        <h1>${podcast.title}</h1>
        <div class='actions'>
          <${Button}
            icon=${remembered ? 'bookmark' : 'bookmark-unfilled'}
            title=${remembered ? 'Remove from the shortlist' : 'Keep for a closer look later'}
            onClick=${remember}
            />
          ${subscribed
            ? html`<${Button} icon='check' label='In library' onClick=${() => app.go('podcast', podcast.id)} />`
            : html`<${Button} icon='add'   label='Subscribe'  onClick=${subscribe} disabled=${busy.value} />`}
        </div>
      </header>

      <main>
        <${Artwork} src=${podcast.image} />

        <div class='info'>
          <div class='stats'>${episodes.length} episode(s)</div>
          ${podcast.author && html`<div class='author'>${podcast.author}</div>`}
          ${paras.map(paragraph => html`<p class='about'>${paragraph}</p>`)}
          ${podcast.link && html`<${Link} href=${podcast.link} icon='mdi:web' label='Website' />`}
          <${Link} href=${url} icon='rss' label='Feed' />
        </div>

        <div class='section'><span>Episodes</span></div>

        <${PreviewEpisodes}
          episodes=${sorted}
          empty=${{ icon: 'mdi:playlist-remove', title: 'This feed has no playable episodes' }}
          />
      </main>
    </${View}>
  `;
}
