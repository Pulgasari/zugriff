// ebooks :: views/ReaderView.js

function ReaderView ({ bookKey }) {
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const tocRef = useRef(null);
  const book = db.bookByKey(bookKey);

  useEffect(() => {
    if (!book) return;
    let alive = true;
    let saveTimer = 0;
    let latest = null;
    readerUi.value = { ready: false, error: null, kind: book.kind, tocOpen: false, toc: null };

    const flush = () => { if (latest) { db.saveProgress(bookKey, latest); latest = null; } };
    const onState = st => {
      // merge live state into the ui and debounce the persisted write
      readerUi.value = { ...readerUi.value, ...st };
      latest = book.kind === 'pdf'
        ? { page: st.page, pages: st.pages, percent: st.percent }
        : { location: st.cfi, percent: st.percent };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 800);
    };

    (async () => {
      try {
        const file = await db.openFile(book);
        if (!alive) return;
        const prog = db.progressOf(bookKey);
        const engine = book.kind === 'pdf'
          ? await createPdfReader(stageRef.current, file, { initialPage: prog?.page || 1, onState })
          : await createEpubReader(stageRef.current, file, {
              initialCfi: prog?.location || null,
              flow: readerFlow.value, fontSize: readerFont.value, onState,
            });
        if (!alive) { engine.destroy(); return; }
        engineRef.current = engine;
        readerUi.value = { ...readerUi.value, ready: true, kind: engine.kind, flow: engine.flow, fontSize: engine.fontSize };
      } catch (err) {
        if (alive) readerUi.value = { ...readerUi.value, ready: true, error: err.message };
      }
    })();

    return () => {
      alive = false;
      clearTimeout(saveTimer); flush();
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [bookKey]);

  // keyboard: page/chapter turn (component-scoped, tied to the live engine ref)
  useEffect(() => {
    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (e.key === 'ArrowLeft')  eng.prev();
      if (e.key === 'ArrowRight') eng.next();
      if (e.key === 'Escape')     closeReader();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleToc = async () => {
    const ui = readerUi.value;
    if (!ui.tocOpen && ui.toc == null) {
      readerUi.value = { ...ui, tocOpen: true, toc: [] };
      const items = await engineRef.current?.outline?.() ?? [];
      readerUi.value = { ...readerUi.value, toc: items };
    } else {
      readerUi.value = { ...ui, tocOpen: !ui.tocOpen };
    }
  };

  const ui = readerUi.value;
  const eng = engineRef.current;

  return html`
    <div class="reader">
      <header class="reader-bar">
        <${IconButton} icon="arrow-left" label="Back" title="Back to library" onClick=${closeReader} />
        <div class="reader-id">
          <span class="reader-title">${book?.title ?? 'Book'}</span>
          ${book?.author && html`<span class="reader-author">${book.author}</span>`}
        </div>

        <div class="reader-controls">
          ${ui.kind === 'pdf' && html`
            <${IconButton} icon="mdi:minus" label="Zoom out" onClick=${() => eng?.zoomOut()} />
            <${IconButton} icon="mdi:plus"  label="Zoom in"  onClick=${() => eng?.zoomIn()} />`}
          ${ui.kind === 'epub' && html`
            <${IconButton} icon="mdi:format-font-size-decrease" label="Smaller text" disabled=${!eng} onClick=${() => { if (!eng) return; eng.fontDown(); readerFont.value = eng.fontSize; }} />
            <${IconButton} icon="mdi:format-font-size-increase" label="Larger text"  disabled=${!eng} onClick=${() => { if (!eng) return; eng.fontUp();   readerFont.value = eng.fontSize; }} />
            <${IconButton} icon=${ui.flow === 'scrolled' ? 'mdi:book-open-page-variant-outline' : 'mdi:page-layout-body'}
              label=${ui.flow === 'scrolled' ? 'Paginated' : 'Scrolled'} disabled=${!eng}
              onClick=${async () => { if (!eng) return; const f = ui.flow === 'scrolled' ? 'paginated' : 'scrolled'; readerFlow.value = f; await eng.setFlow(f); readerUi.value = { ...readerUi.value, flow: f }; }} />`}
          <${IconButton} icon="mdi:table-of-contents" label="Contents" active=${ui.tocOpen} onClick=${toggleToc} />
        </div>
      </header>

            <div class="reader-main">
        <div class="reader-stage" ref=${stageRef}></div>

        ${ui.tocOpen && html`
          <${TocPanel} items=${ui.toc} kind=${ui.kind}
            onPick=${target => { if (ui.kind === 'pdf') eng?.gotoDest(target); else eng?.gotoHref(target); readerUi.value = { ...readerUi.value, tocOpen: false }; }} />`}

        ${!ui.ready && !ui.error && html`
          <div class="reader-loading"><${Icon} name="svg-spinners:bars-scale-middle" /></div>`}
        ${ui.error && html`
          <div class="reader-error"><${Empty} icon="mdi:book-alert-outline" title="Couldn’t open this book" hint=${ui.error} /></div>`}

        ${ui.kind === 'epub' && ui.ready && !ui.error && html`
          <button class="page-edge left"  aria-label="Previous" onClick=${() => eng?.prev()}><${Icon} name="mdi:chevron-left" /></button>
          <button class="page-edge right" aria-label="Next"     onClick=${() => eng?.next()}><${Icon} name="mdi:chevron-right" /></button>`}
      </div>

      <footer class="reader-foot">
        ${ui.kind === 'pdf' && ui.pages
          ? html`
            <button class="ibtn" aria-label="Previous page" onClick=${() => eng?.prev()}><${Icon} name="mdi:chevron-up" /></button>
            <span class="foot-label">Page ${ui.page ?? 1} / ${ui.pages}</span>
            <button class="ibtn" aria-label="Next page" onClick=${() => eng?.next()}><${Icon} name="mdi:chevron-down" /></button>`
          : html`<span class="foot-label">${ui.percent != null ? Math.round((ui.percent || 0) * 100) + '%' : ''}</span>`}
        <aufbau-progress class="foot-bar" value=${Math.round((ui.percent || 0) * 100)}></aufbau-progress>
      </footer>
    </div>`;
}
