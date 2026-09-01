// components/Prompt.js
// a single overlay shared by everything that needs to ask for one value.
// render <${Prompt} /> once per app, call openPrompt() from anywhere.

import { html, signal } from './../vendors.js';
import GhostButton from './GhostButton.js';

const promptState = signal(null);

function openPrompt ({ title, placeholder = '', type = 'text', value = '', onConfirm, onCancel }) {
  promptState.value = { title, placeholder, type, value, onConfirm, onCancel };
}

function Prompt () {
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
  const onInput = event => { promptState.value = { ...state, value: event.target.value }; };

  return html`
    <div class="prompt" onClick=${cancel}>
      <div class="dialog" onClick=${event => event.stopPropagation()}>
        <div class="header">
          <span class="title">${state.title}</span>
          <${GhostButton} icon="close" onClick=${cancel} />
        </div>
        <input
          type=${state.type}
          placeholder=${state.placeholder}
          value=${state.value}
          autoFocus
          onInput=${onInput}
          onKeyDown=${onKeyDown}
        />
        <div class="actions">
          <button class="primary"   onClick=${confirm} disabled=${!state.value}>Confirm</button>
          <button class="secondary" onClick=${cancel}>Cancel</button>
        </div>
      </div>
    </div>`;
}

export       { Prompt, openPrompt };
export default Prompt;

