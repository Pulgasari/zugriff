const doExport = () => {
    const data = db.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `podcasts-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast.success(`Exported ${data.feeds.length} subscription${data.feeds.length === 1 ? '' : 's'}`);
  };

  const doImport = async file => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { app.toast.error('Could not read that file'); return; }
    app.state.dialog = null;
    app.state.busy = 'Importing…';
    try {
      const results = await db.importData(data, app.settings.proxy, (n, total) => app.state.busy = `Importing ${n}/${total}…`);
      const added   = results.filter(r => r.added).length;
      const failed  = results.filter(r => r.error).length;
      app.toast({ message: `Imported ${added} new` + (failed ? `, ${failed} failed` : ''), type: failed ? 'error' : 'success' });
    } catch (err) { app.toast.error(err); }
    finally { app.state.busy = ''; }
  };

function Export () {
  return html`
    <div class="field">
      <span class="field-label">Subscriptions</span>
      <span class="field-hint">Back up your subscriptions and listening progress as JSON, or restore from a file.</span>
      <span class="field-row">
        <${Button} icon='download' label='Export JSON' onClick=${doExport} />
        <${Button} icon='upload'   label='Import JSON' onClick=${() => fileRef.current?.click()} />
        
        <input hidden
          ref=${fileRef} 
          type="file" 
          accept="application/json,.json" 
          onChange=${e => { doImport(e.target.files[0]); e.target.value = ''; }} 
          />
      </span>
    </div>
  `;
}
