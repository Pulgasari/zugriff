// apps/podcasts/dialogs/AddPodcastDialog.js
// paste a feed url, subscribe, then open the new podcast.

import { useSignal } from '@aufbau/signals';
import Modal from '/.shared/js/components/Modal.js';

const app = zugriff.app;

export default function AddPodcastDialog () {
  const state = useSignal({ url: '', loading: false });

  const close = () => app.state.dialog = null;

  const submit = async () => {
    const url = state.url.trim();
    if (!url || state.loading) return;
    state.loading = true;
    try {
      const podcast = await app.db.subscribe(url, app.settings.proxy);
      app.toast.success(`Subscribed to ${podcast.title}`);
      close();
      app.go('podcast', podcast.id);
    } catch (error) {
      close();
      app.toast.error(error);
    }
  };

  const actions = [
    { label: state.loading ? 'loading' : 'subscribe', onClick: submit, disabled: state.loading },
    { label: 'cancel', onClick: close },
  ];

  return html`
    <${Modal} headline='Add a podcast' actions=${actions} onClose=${close}>
      <p>Paste the podcast's RSS feed URL.</p>
      <input
        type='url'
        placeholder='https://example.com/feed.xml'
        value=${state.url}
        onInput=${e => state.url = e.target.value}
        onKeyDown=${e => { if (e.key === 'Enter') submit(); }}
        />
    <//>
  `;
}
