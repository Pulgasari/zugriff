// ebooks :: components/BookItem.js

import Cover    from './Cover.js';
import Progress from '/.shared/js/components/Progress.js';

function BookItem ({ book }) {
  const p = pct(book.key);
  return html`
    <button class='' onClick=${() => openReader(book.key)} title=${book.name}>
      <${Cover} book=${book} />
      <div class='meta'>
        <div class="book-title">${book.title}</div>
        ${book.author && html`<div class='author'>${book.author}</div>`}
      </div>
      ${p > 0 && html`<${Progress} value=${Math.round(p * 100)} />`}
    </button>
  `;
}

export default BookItem;
