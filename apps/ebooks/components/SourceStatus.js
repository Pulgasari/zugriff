// ebooks :: components/SourceStatus.js
// the folders that need reconnecting after a reload

import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;

function reconnect (source) {
  app.db.reconnect(source.id).then(result => {
    if (result.granted) return;
    const why = result.error ? `${result.error.name || 'error'}` : `browser said “${result.state}”`;
    console.warn('[ebooks] reconnect failed', { source, ...result });
    app.toast.error(`Reconnect failed — ${why}. Try “Choose folder”.`);
  });
}

const repick = source => app.db.repick(source.id).then(ok => ok || app.toast.error(`Could not open ${source.name}`));

function SourceStatus () {
  const perms = app.db.perms.value;
  const stale = app.db.sources.value.filter(source => perms[source.id] && perms[source.id] !== 'granted');
  if (!stale.length) return null;
  return html`
    <div class="reconnect-bar">
      <${Icon} name="mdi:folder-alert-outline" />
      <span>${stale.length} folder${stale.length === 1 ? '' : 's'} need reconnecting to read on this device.</span>
      ${stale.map(source => html`
        <div key=${source.id} class="reconnect-item">
          <span class="reconnect-name">${source.name}</span>
          <button class="btn small primary" onClick=${() => reconnect(source)}>
            <${Icon} name="mdi:folder-key-outline" /> Reconnect</button>
          <button class="btn small ghost" title="Re-select the folder — always works" onClick=${() => repick(source)}>
            <${Icon} name="mdi:folder-search-outline" /> Choose folder</button>
        </div>`)}
    </div>
  `;
}

export       { SourceStatus };
export default SourceStatus;
