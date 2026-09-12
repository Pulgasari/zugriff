// ebooks :: components/Cover.js

// a cover: the extracted image if we have it, otherwise a titled placeholder
function Cover ({ book, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !book.cover) return;
    const url = URL.createObjectURL(book.cover);
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('has-img');
    return () => { URL.revokeObjectURL(url); el.style.backgroundImage = ''; el.classList.remove('has-img'); };
  }, [book.cover]);

  return html`
    <div ref=${ref} class=${'cover ' + className} style=${`--hue:${hueOf(book.title)}`}>
      ${!book.cover && html`
        <div class="cover-fallback">
          <${Icon} name=${book.kind === 'pdf' ? 'mdi:file-pdf-box' : 'mdi:book-open-page-variant-outline'} />
          <span class="cover-title">${book.title}</span>
          ${book.author && html`<span class="cover-author">${book.author}</span>`}
        </div>`}
      <span class=${'kind-badge ' + book.kind}>${book.kind.toUpperCase()}</span>
    </div>
  `;
}

export default Cover;
