function AddPodcastPanel () {
  const value = useSignal('');
  const state = useSignal({ loading: false, error: '' });
  const ref   = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = async () => {
    const url = value.value.trim();
    if (!url) return;
    state.value = { loading: true, error: '' };
    try {
      const p = await db.subscribe(url, proxy.value);
      flash(`Subscribed to ${p.title}`);
      dialog.value = null;
      go('podcast', p.id);
    } catch (err) {
      state.value = { loading: false, error: err.message };
    }
  };

  return html`
    <${Scrim}>
      <div class="modal">
        <h2>Add a podcast</h2>
        <p class="modal-sub">Paste the podcast's RSS feed URL.</p>
        <input ref=${ref} class="modal-input" type="url" placeholder="https://example.com/feed.xml"
               value=${value.value}
               onInput=${e => value.value = e.target.value}
               onKeyDown=${e => { if (e.key === 'Enter') submit(); }} />
        ${state.value.error && html`<p class="modal-err">${state.value.error}</p>`}
        <div class="modal-actions">
          <button class="btn ghost" onClick=${() => dialog.value = null}>Cancel</button>
          <button class="btn primary" disabled=${state.value.loading} onClick=${submit}>
            ${state.value.loading ? html`<${Icon} name="svg-spinners:bars-scale-middle" /> Fetching…` : 'Subscribe'}
          </button>
        </div>
      </div>
    <//>`;
}

export default AddPodcastPanel;
