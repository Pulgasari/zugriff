// apps/code/components/Commands.js
// the command palette — search every command, star favourites, run one.

import { html, useState } from '@aufbau/kits/preact-htm';
import { stored } from './../../../.shared/js/lib/signals.js';
import state from './../state.js';
import Modal from './Modal.js';
import Icon  from './Icon.js';

export const favoritesSignal = stored([], 'code:favs');

export default function Commands () {
  const [search, setSearch] = useState('');
  const favorites = favoritesSignal.value;

  const toggleFavorite = (event, key) => {
    event.stopPropagation();
    favoritesSignal.value = favorites.includes(key)
      ? favorites.filter(k => k !== key)
      : [...favorites, key];
  };

  const run = key => { state.modal.value = null; state.exec(key); };

  const query = search.toLowerCase();
  const filtered = Array.from(state.commands.entries()).filter(([key, cmd]) =>
    key.toLowerCase().includes(query) || (cmd.name && cmd.name.toLowerCase().includes(query)),
  );

  const favCommands     = filtered.filter(([key]) =>  favorites.includes(key));
  const regularCommands = filtered.filter(([key]) => !favorites.includes(key));

  const renderItem = ([key, cmd]) => {
    const isFav = favorites.includes(key);
    return html`
      <li onClick=${() => run(key)}>
        <strong>${cmd.name || key}</strong>
        <small>${key}</small>
        <div class="fav-btn" onClick=${event => toggleFavorite(event, key)}>
          <${Icon} name=${isFav ? 'bxs:heart' : 'bx:heart'} color=${isFav ? 'var(--accent, currentcolor)' : 'currentColor'} />
        </div>
      </li>`;
  };

  return html`
    <${Modal} id="commands" title="Commands">
      <div class="commands-header">
        <input
          type="text"
          placeholder="Search commands…"
          value=${search}
          onInput=${event => setSearch(event.target.value)}
          autoFocus
        />
      </div>

      <div class="commands-body">
        ${favCommands.length > 0 && html`
          <h3>Favourites</h3>
          <ul class="commands-list favorites">${favCommands.map(renderItem)}</ul>`}

        <h3>All</h3>
        ${regularCommands.length > 0 && html`
          <ul class="commands-list">${regularCommands.map(renderItem)}</ul>`}

        ${filtered.length === 0 && html`<p class="none">No commands found.</p>`}
      </div>
    </${Modal}>
  `;
}
