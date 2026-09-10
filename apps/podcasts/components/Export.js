import createElement from '@domina/methods/createElement.js';

const app = zugriff.app;

const exportFeeds = () => {
  const data = db.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const name = `podcasts-${date}.json`;
  const a    = createElement('a', { href, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    app.toast.success(`Exported ${data.feeds.length} subscription(s)`);
};

  const importFeeds = async file => {
    if (!file) return;
    let data;
    try   { data = JSON.parse(await file.text()); }
    catch { app.toast.error('Could not read that file'); return; }
    
    app.state.dialog = null;
    app.state.busy = 'Importing…';
    
    try {
      const results = await db.importData(data, app.settings.proxy, (n, total) => app.state.busy = `Importing ${n}/${total}…`);
      const added   = results.filter(r => r.added).length;
      const failed  = results.filter(r => r.error).length;

      app.toast({ 
        message : `added: ${added} | failed: ${failed}`,
        type    : failed ? 'error' : 'success
      });
    } 
    catch (error) { app.toast(error); }
    finally       { app.state.busy = ''; }
  };

function Export () {
  return html`
    <div>
      <span class="field-label">Subscriptions</span>
      <i>Back up your subscriptions and listening progress as JSON, or restore from a file.</i>
      <span>
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
