// shared/js/components/Prompt.js
//
// a single overlay shared by everything that needs to ask for one value.
// render <${Prompt} /> once per app, call openPrompt() from anywhere.

import { html, signal } from '@aufbau/kits/preact-htm';
import GhostButton from './GhostButton.js';

const promptState = signal(null);

export function openPrompt ({ title, placeholder = '', type = 'text', onConfirm, onCancel }) {
  promptState.value = { title, placeholder, type, value: '', onConfirm, onCancel };
}

export function Prompt () {
  const state = promptState.value;
  if (!state) return null;

  const confirm = () => {
    const value = state.value;
    promptState.value = null;
    state.onConfirm?.(value);
  };
  const cancel = () => {
    promptState.value = null;
    state.onCancel?.();
  };
  const onKeyDown = event => {
    if (event.key === 'Enter')  confirm();
    if (event.key === 'Escape') cancel();
  };

  return html`
    <div class="prompt-overlay" onClick=${cancel}>
      <div class="prompt-dialog" onClick=${event => event.stopPropagation()}>
        <div class="prompt-header">
          <span class="prompt-title">${state.title}</span>
          <${GhostButton} icon="mdi:close" onClick=${cancel} />
        </div>
        <input
          class="prompt-input"
          type=${state.type}
          placeholder=${state.placeholder}
          value=${state.value}
          autoFocus
          onInput=${event => { promptState.value = { ...state, value: event.target.value }; }}
          onKeyDown=${onKeyDown}
        />
        <div class="prompt-actions">
          <button class="btn secondary" onClick=${cancel}>Cancel</button>
          <button class="btn primary"   onClick=${confirm} disabled=${!state.value}>Confirm</button>
        </div>
      </div>
    </div>`;
}

export default Prompt;
