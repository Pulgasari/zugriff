// tools :: views/ShelfView.js
// every tool, filtered by category and by a search over name and description

import { computed, signal } from '@aufbau/signals';

import SearchPanel from '/.shared/js/components/SearchPanel.js';
import ViewHeader  from '/.shared/js/components/ViewHeader.js';

import { categories, tools } from './../tools.js';

const app = zugriff.app;

const query    = signal('');
const category = signal('');

const visible = computed(() => {
  const text = query.value.trim().toLowerCase();
  return tools.filter(tool =>
    (!category.value || tool.categories?.includes(category.value)) &&
    (!text || tool.name.toLowerCase().includes(text) || tool.description?.toLowerCase().includes(text))
  );
});

// a real link, so a tool opens in a new tab as well. a plain click goes through app.go
const open = (event, slug) => { event.preventDefault(); app.go(slug); };

function Chip ({ name, label = name }) {
  const active = category.value === name;
  return html`<btn-push label=${label} class=${active ? 'chip active' : 'chip'} onClick=${() => category.value = name} />`;
}

export default function ShelfView () {
  const list    = visible.value;
  const actions = html`<btn-icon icon='settings' label='settings' onClick=${() => app.area('config')?.toggle()} />`;

  return html`
    <${ViewHeader} title='tools' tools=${actions} />

    <main>
      <div class='categories'>
        <${Chip} name='' label='all' />
        ${categories.map(name => html`<${Chip} key=${name} name=${name} />`)}
      </div>

      <ul class='shelf'>
        ${list.map(tool => html`
          <li key=${tool.slug}>
            <a href=${`#/${tool.slug}`} onClick=${event => open(event, tool.slug)}>
              <span class='title'>
                <span class='name'>${tool.name}</span>
                ${tool.description && html`<span class='desc'>${tool.description}</span>`}
              </span>
              <svg-icon class='logo' icon=${tool.icon} />
            </a>
          </li>
        `)}
      </ul>

      ${!list.length && html`<p class='empty'>nothing matches “${query.value}”.</p>`}

      <${SearchPanel} class='search sticky' signal=${query} />
    </main>
  `;
}
