// apps/podcasts/panels/AddPodcastPanel.js
// the "add a podcast" dialog — paste a feed url, subscribe, open the new podcast.

import { useSignal }        from '@aufbau/signals';
import { useEffect, useRef } from 'preact/hooks';

import Icon  from '/.shared/js/components/Icon.js';
import Modal from '/.shared/js/components/Modal.js';

import Scrim from './../components/Scrim.js';

const app = zugriff.app;
const { db, go, flash } = app;

export default function AddPodcastPanel () {
  const value = useSignal('');
  const state = useSignal({ loading: false, error: '' });
  const ref   = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = async () => {
    const url = value.value.trim();
    if (!url) return;
    state.value = { loading: true, error: '' };
    try {
      const p = await db.subscribe(url, app.settings.proxy);
      flash(`Subscribed to ${p.title}`);
      app.state.dialog = null;
      go('podcast', p.id);
    } catch (err) {
      state.value = { loading: false, error: err.message };
    }
  };

  const cancel = () => app.state.dialog = null;

  const isLoading = state.value.loading;
  
  const actions = [
    { 
      disabled : isLoading ,
      label    : isLoading ? 'loading' : 'subscribe', 
      onClick  : submit, 
    },
    { label: 'cancel', onClick: cancel },
  ];

  return html`
    <${Modal}
      headline='Add a podcast'
      actions=${actions}
    >
      <p>Paste the podcast's RSS feed URL.</p>
      <input 
        ref=${ref} 
        type='url'
        placeholder="https://example.com/feed.xml"
        value=${value.value}
        onInput=${e => value.value = e.target.value}
        onKeyDown=${e => { if (e.key === 'Enter') submit(); }} 
        />
        ${state.value.error && html`<p class="modal-err">${state.value.error}</p>`}
        <div class="modal-actions">
          <button class="btn ghost" onClick=${}>Cancel</button>
          <button class="btn primary" disabled=${} onClick=${submit}>
            ${state.value.loading ? html`<${Icon} name="svg-spinners:bars-scale-middle" /> Fetching…` : 'Subscribe'}
          </button>
        </div>
    <${Modal}>`;
}
