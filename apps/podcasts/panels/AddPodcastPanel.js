// apps/podcasts/panels/AddPodcastPanel.js
// the "add a podcast" dialog — paste a feed url, subscribe, open the new podcast.

import { useSignal } from '@aufbau/signals';
import Icon  from '/.shared/js/components/Icon.js';
import Modal from '/.shared/js/components/Modal.js';


const app = zugriff.app;

export default function AddPodcastPanel () {
  const state = useSignal({
    val       : '',
    isError   : false,
    isLoading : false,
  });

  const close = () => app.state.dialog = null;
  
  const submit = async () => {
    const url = state.val.trim(); if (!url) return;
    state.isLoading = true;
    try {
      const p = await app.db.subscribe(url, app.settings.proxy);
      app.toast({ success: `Subscribed to ${p.title}` });
      close();
      app.go('podcast', p.id);
    }
    catch (error) {
      close();
      app.toast({ error });
    }
  };

  const actions = [
    { 
      disabled : state.isLoading ,
      label    : state.isLoading ? 'loading' : 'subscribe', 
      onClick  : submit, 
    },
    { label: 'cancel', onClick: close },
  ];

  return html`
    <${Modal}
      headline='Add a podcast'
      actions=${actions}
    >
      <p>Paste the podcast's RSS feed URL.</p>
      <input 
        type='url'
        placeholder="https://example.com/feed.xml"
        value=${state.val}
        onInput=${e => state.val = e.target.value}
        onKeyDown=${e => { if (e.key === 'Enter') submit(); }} 
        />
        
    <${Modal}>
  `;
}
