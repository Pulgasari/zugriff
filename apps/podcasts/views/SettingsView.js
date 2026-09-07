// podcasts :: views/SettingsView.js

function SettingsView () {
  const proxyVal   = useSignal(proxy.value);
  const resizerVal = useSignal(imgResizer.value);
  const fileRef    = useRef(null);

  const doExport = () => {
    const data = db.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `podcasts-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(`Exported ${data.feeds.length} subscription${data.feeds.length === 1 ? '' : 's'}`);
  };

  const doImport = async file => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { flash('Could not read that file', 'err'); return; }
    dialog.value = null;
    busy.value = 'Importing…';
    try {
      const results = await db.importData(data, proxy.value, (n, total) => busy.value = `Importing ${n}/${total}…`);
      const added   = results.filter(r => r.added).length;
      const failed  = results.filter(r => r.error).length;
      flash(`Imported ${added} new` + (failed ? `, ${failed} failed` : ''), failed ? 'err' : 'ok');
    } catch (err) { flash(err.message, 'err'); }
    finally { busy.value = ''; }
  };

  return html`
    <${Scrim}>
      <div class="modal wide">
        <h2>Settings</h2>

        <div class="field">
          <span class="field-label">Menu position</span>
          <${SortPicker} value=${menuPos.value} onChange=${v => menuPos.value = v}
             options=${[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]} />
        </div>

        <div class="field">
          <span class="field-label">Player position</span>
          <${SortPicker} value=${playerPos.value} onChange=${v => playerPos.value = v}
             options=${[['top', 'Top'], ['bottom', 'Bottom']]} />
        </div>

        <label class="field">
          <span class="field-label">CORS proxy</span>
          <span class="field-hint">Most podcast feeds block direct browser requests. Feeds are fetched directly first, then through this proxy. <code>{url}</code> is replaced with the feed URL. Clear it to use direct requests only.</span>
          <input class="modal-input" type="text" value=${proxyVal.value}
                 placeholder=${DEFAULT_PROXY}
                 onInput=${e => proxyVal.value = e.target.value} />
          <span class="field-row">
            <button class="btn ghost small" onClick=${() => proxyVal.value = DEFAULT_PROXY}>Reset to default</button>
            <button class="btn ghost small" onClick=${() => proxyVal.value = ''}>Direct only</button>
          </span>
        </label>
        <label class="field">
          <span class="field-label">Artwork resizer</span>
          <span class="field-hint">A self-hosted endpoint that shrinks cover art server-side (see <code>/img-proxy</code>), so no third party is involved. <code>{url}</code> is the image, <code>{w}</code> the width. Clear it to resize in the browser instead (only works for images whose host allows it).</span>
          <input class="modal-input" type="text" value=${resizerVal.value}
                 placeholder=${DEFAULT_IMG_RESIZER}
                 onInput=${e => resizerVal.value = e.target.value} />
          <span class="field-row">
            <button class="btn ghost small" onClick=${() => resizerVal.value = DEFAULT_IMG_RESIZER}>Reset to default</button>
            <button class="btn ghost small" onClick=${() => resizerVal.value = ''}>In-browser</button>
          </span>
        </label>

        <div class="field">
          <span class="field-label">Subscriptions</span>
          <span class="field-hint">Back up your subscriptions and listening progress as JSON, or restore from a file.</span>
          <span class="field-row">
            <button class="btn" onClick=${doExport}><${Icon} name="mdi:download" /> Export JSON</button>
            <button class="btn" onClick=${() => fileRef.current?.click()}><${Icon} name="mdi:upload" /> Import JSON</button>
            <input ref=${fileRef} type="file" accept="application/json,.json" hidden
                   onChange=${e => { doImport(e.target.files[0]); e.target.value = ''; }} />
          </span>
        </div>

        <${AppSettings} />

        <div class="modal-actions">
          <button class="btn primary" onClick=${() => {
            proxy.value      = proxyVal.value.trim();
            imgResizer.value = resizerVal.value.trim();
            dialog.value = null; flash('Settings saved');
          }}>Done</button>
        </div>
      </div>
    <//>
  `;
}
