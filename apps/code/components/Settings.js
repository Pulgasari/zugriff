// apps/code/components/Settings.js
// the settings modal: a UI section (app theme, chrome options) and an editor
// section (Monaco theme + construction options).

import { html } from './../vendors.js';
import { themeNames } from '/.shared/js/data/themes.js';
import Modal from './Modal.js';
import Picker from './Picker.js';
import Toggle from './Toggle.js';
import Dropdown from './Dropdown.js';

const app = zugriff.app;

const editorPickers = [
  { key: 'fontSize'         , options: [8, 9, 10, 11, 12, 13, 14, 16, 18] },
  { key: 'autoIndent'       , options: ['none', 'keep', 'brackets', 'advanced', 'full'] },
  { key: 'cursorBlinking'   , options: ['blink', 'smooth', 'phase', 'expand', 'solid'] },
  { key: 'cursorStyle'      , options: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'] },
  { key: 'wordWrap'         , options: ['off', 'on', 'wordWrapColumn', 'bounded'] },
  { key: 'wrappingStrategy' , options: ['simple', 'advanced'] },
];
const editorToggles = [
  'contextmenu', 'folding', 'fontLigatures', 'lineNumbers',
  'readOnly', 'scrollBeyondLastLine', 'showUnused', 'wordBasedSuggestions',
];
const uiPickers = [
  { key: 'fileSizeFormat', options: ['bytes', 'chars', 'formatted'] },
];
const uiToggles = ['disableAndroidKeyboard'];

// ── UI section fields ─────────────────────────────────────────────────────
const UiPickerField = ({ key, options }) => html`
  <div class="field settings-field">
    <label>${key}</label>
    <${Picker} options=${options} value=${app.state.config[key]} callback=${v => (app.state.config[key] = v)} />
  </div>`;

const UiToggleField = key => html`
  <div>
    <${Toggle} label=${key} value=${app.state.config[key]} onChange=${() => (app.state.config[key] = !app.state.config[key])} />
  </div>`;

// ── editor section fields ─────────────────────────────────────────────────
const EditorPickerField = ({ key, options }) => html`
  <div class="field settings-field">
    <label>${key}</label>
    <${Picker} options=${options} value=${app.editor.config.value[key]} callback=${v => app.editor.updateConfig({ [key]: v })} />
  </div>`;

const EditorToggleField = key => {
  const raw = app.editor.config.value[key];
  const checked = raw === true || raw === 'on';
  return html`
    <div>
      <${Toggle} label=${key} value=${checked} onChange=${() => app.editor.toggleConfig(key)} />
    </div>`;
};

export default function Settings () {
  return html`
    <${Modal} id="settings" title="Settings">
      <div class="section">
        <h3>UI</h3>
        <${Dropdown}
          options=${themeNames}
          selected=${app.state.theme}
          onChange=${event => (app.state.theme = event.currentTarget.value)}
        />
        ${uiToggles.map(UiToggleField)}
        ${uiPickers.map(UiPickerField)}
      </div>
      <div class="section">
        <h3>GitHub</h3>
        <${Toggle}
          label="Prompt for commit message"
          value=${app.state.config.commitPrompt}
          onChange=${() => (app.state.config.commitPrompt = !app.state.config.commitPrompt)}
        />
      </div>
      <div class="section">
        <h3>Editor</h3>
        <${Dropdown}
          options=${app.editor.themes}
          selected=${app.editor.config.value.theme}
          onChange=${event => app.editor.updateTheme(event.currentTarget.value)}
        />
        ${editorToggles.map(EditorToggleField)}
        ${editorPickers.map(EditorPickerField)}
      </div>
    </${Modal}>
  `;
}
