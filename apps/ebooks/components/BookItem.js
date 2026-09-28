// ebooks :: components/BookItem.js

import Cover    from './Cover.js';
import Progress from '/.shared/js/components/Progress.js';

const app = zugriff.app;

function BookItem ({ book }) {
  const percent = app.percentOf(book.key);
  return html`
    <button class="book" onClick=${() => app.openReader(book.key)} title=${book.name}>
      <${Cover} book=${book} className="book-cover" />
      <div class="book-meta">
        <div class="book-title">${book.title}</div>
        ${book.author && html`<div class="book-author">${book.author}</div>`}
      </div>
      ${percent > 0 && html`<${Progress} class="book-progress" value=${Math.round(percent * 100)} />`}
    </button>
  `;
}

export       { BookItem };
export default BookItem;
