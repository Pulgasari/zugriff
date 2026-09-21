// podcasts :: components/ExploreIndex.js
// a list of podcasts that are not subscriptions: directory hits and shortlist rows,
// which are the same record at two points in time. remembering and subscribing are
// both on the row, so neither needs a detour through the detail view.

import ActionMenu from '/.shared/js/components/ActionMenu.js';
import Button     from '/.shared/js/components/Button.js';
import Empty      from '/.shared/js/components/Empty.js';
import Index      from '/.shared/js/components/Index.js';

import Artwork    from './Artwork.js';

const app = zugriff.app;

// `remembered` and `subscribed` are decided by the view — it holds both tables
// already, and a lookup per row would be a db read per row.
function Item ({ entry, remembered, subscribed, onSubscribe }) {
  const open = () => app.go('explore-podcast', entry.url);

  const sub = [entry.author, entry.genre, entry.count ? `${entry.count} episode(s)` : '']
    .filter(Boolean)
    .join(' · ');

  return html`
    <aufbau-item class:subscribed=${subscribed}>
      <${Artwork} aria-label='open podcast' onClick=${open} src=${entry.image} />

      <div class='meta'>${sub}</div>

      <${Button} class='title' label=${entry.title} onClick=${open} />

      <${ActionMenu} items=${[
        {
          icon    : remembered ? 'bookmark' : 'bookmark-unfilled',
          label   : remembered ? 'Forget'   : 'Remember',
          title   : remembered ? 'Remove from the shortlist' : 'Keep for a closer look later',
          onClick : () => app.explore.toggleRemembered(entry),
        },
        subscribed
          ? { icon: 'check', label: 'In library', onClick: () => app.go('podcast', entry.id) }
          : { icon: 'add',   label: 'Subscribe',  onClick: () => onSubscribe?.(entry) },
      ]} />
    </aufbau-item>
  `;
}

function ExploreIndex ({ entries, remembered, subscribed, empty, onSubscribe }) {
  if (!entries.length) return html`<${Empty} ...${empty} />`;

  return html`
    <${Index} viewmode='list'>
      ${entries.map(entry => html`
        <${Item}
          key=${entry.id}
          entry=${entry}
          remembered=${remembered.has(entry.id)}
          subscribed=${subscribed.has(entry.id)}
          onSubscribe=${onSubscribe}
        />
      `)}
    </${Index}>
  `;
}

export default ExploreIndex;
