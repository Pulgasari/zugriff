// ebooks :: views/LibraryView.js

import Brand       from '/.shared/js/components/Brand.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import InstallTip  from '/.shared/js/components/InstallTip.js';
import Index       from '/.shared/js/components/Index.js';
import Picker      from '/.shared/js/components/SortPicker.js';
import SearchInput from '/.shared/js/components/SearchInput.js';

const app = zugriff.app;

function BooksIndex () {
  return html`
    <${Index} viewmode='grid' item-size='150px' gap='1rem'>
      ${books.map(b => html`<aufbau-item key=${b.key}><${BookCard} book=${b} /></aufbau-item>`)}
    </${Index}>
  `;
}

function LibraryView () {
  const books      = visibleBooks.value;
  const cont       = continueReading.value;
  const hasFolders = app.db.sources.value.length > 0;

  return html`
    <div class="library">
      <header class="lib-head">
        <${Brand} icon=${app.config.icon} name=${app.config.name} />
        
        <div class="lib-tools">
          ${db.pending.value > 0 && html`<span class="scan-note"><${Icon} name="loading" /> ${db.pending.value} left</span>`}
          <${IconButton} icon="refresh"    label="Rescan folders" onClick=${() => db.rescanAll()} />
          <${IconButton} icon='folder-add' label='Add folder'     onClick=${addFolder} />
          <${Settings} />
        </div>
      </header>

      <${SourceStatus} />
      <${InstallTip}/>

      ${!hasFolders
        ? html`
          <${Empty} icon='books' title="Your library is empty"
            hint="Add a folder of EPUB and PDF files. It stays on your device — only the folder permission is remembered."
            action=${html`<${Button} icon='folder-add' label='Add a folder' onClick=${addFolder} />`} 
            />`
        : html`
          <div class="lib-controls">
            <${SearchInput} 
              placeholder="Search title or author…" 
              value=${app.state.search} 
              onInput=${e => app.state.search = e.target.value} 
              />     
              
            <${Picker} 
              value=${sort.value} 
              onChange=${v => sort.value = v}
              options=${['recent', 'title', 'author', 'added']}
              />
          </div>

          <${FolderBar} />

          ${cont.length > 0 && !app.state.search && !app.state.folder && html`
            <section class="shelf">
              <h2 class="shelf-title">Continue reading</h2>
              <div class="shelf-row">
                ${cont.map(b => html`<${BookCard} book=${b} key=${b.key} />`)}
              </div>
            </section>`}

          <section class="shelf">
            <h2 class="shelf-title">${app.state.folder ? db.sourceById(app.state.folder)?.name : 'All books'}
              <span class="shelf-count">${books.length}</span></h2>
            ${books.length
              ? html`<aufbau-index class="book-grid" viewmode="grid" item-size="150px" gap="1rem">
                  ${books.map(b => html`<aufbau-item key=${b.key}><${BookCard} book=${b} /></aufbau-item>`)}
                </aufbau-index>`
              : html`<${Empty} icon=${app.state.search ? 'mdi:magnify-close' : 'mdi:book-outline'}
                       title=${app.state.search ? 'Nothing matches your search' : 'No books here yet'}
                       hint=${app.state.search ? '' : 'Scanning may still be running, or this folder has no EPUB/PDF files.'} />`}
          </section>`}
    </div>`;
}

export       { LibraryView };
export default LibraryView;
