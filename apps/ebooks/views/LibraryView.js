// ebooks :: views/LibraryView.js

import Brand       from '/.shared/js/components/Brand.js';
import IconButton  from '/.shared/js/components/IconButton.js';
import InstallTip  from '/.shared/js/components/InstallTip.js';
import Index       from '/.shared/js/components/Index.js';
import Picker      from '/.shared/js/components/Picker.js';
import SearchInput from '/.shared/js/components/SearchInput.js';

const app = zugriff.app;

// :::::: SUB-COMPONENTS

function BooksIndex () {
  return html`
    <${Index} viewmode='grid' item-size='150px' gap='1rem'>
      ${books.map(b => html`<aufbau-item key=${b.key}><${BookCard} book=${b} /></aufbau-item>`)}
    </${Index}>
  `;
}

function EmptyLibrary () {
  return html`<${Empty} icon='mdi:book-outline' title='No books here yet' hint='Scanning may still be running, or this folder has no EPUB/PDF files.' />`;
}

function EmptySearch () {
  return html`<${Empty} icon='mdi:magnify-close' title='Nothing matches your search' hint='' />`;
}

// :::::: MAIN COMPONENT

function LibraryView () {
  const books      = visibleBooks.value;
  const cont       = continueReading.value;
  const hasFolders = app.db.sources.value.length > 0;

  return html`
    <${View} class='library'>
      <header>
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
            <${SearchInput} signal=${app.state.search} placeholder='Search title or author…' />
            <${Picker}      signal=${sort.value} options=${['recent', 'title', 'author', 'added']} />
          </div>

          <section class="shelf">
            <h2>All books <span>${books.length}</span></h2>
            
            ${books.length
              ? html`<${BooksIndex}/>`
              : app.state.search 
                ? html`<${EmptySearch}/>`
                : html`<${EmptyLibrary}/>`
            }
          </section>`}
    </${View}>
  `;
}

export       { LibraryView };
export default LibraryView;
