// apps/code/components/Statusbar.js
// the thin info strip above the editor: language, size, indent, and quick
// toggles for wrap / minimap / line numbers, plus the font size.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';

export default function Statusbar () {
  const file        = state.activeFile.value;
  const config      = state.editor.config.value;
  const sizeFormat  = state.config.fileSizeFormat.value;
  const toggle      = state.editor.toggleConfig;

  const formatSize = bytes => {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileSize = () => {
    if (!file) return null;
    const bytes = new Blob([file.content]).size;
    if (sizeFormat === 'bytes') return `${bytes} B`;
    if (sizeFormat === 'chars') return `${file.content.length} chars`;
    return formatSize(bytes);
  };

  const indentStr = config.insertSpaces === false ? 'Tabs' : `Spaces: ${config.tabSize ?? 2}`;
  const wordWrap  = config.wordWrap    !== 'off' ? 'Wrap: on'  : 'Wrap: off';
  const lineNums  = config.lineNumbers === 'on'  ? 'Lines: on' : 'Lines: off';
  const minimap   = config.minimap?.enabled      ? 'Map: on'   : 'Map: off';

  return html`
    <div id="statusbar">
      ${file?.source === 'github' && html`
        <span class="sb-item sb-github" title=${`${file.gh.owner}/${file.gh.name}@${file.gh.branch}`}>
          ${file.gh.owner}/${file.gh.name}@${file.gh.branch}
        </span>
        <span class="sb-sep">·</span>`}
      ${file ? html`
        <span class="sb-item sb-language">${file.language}</span>
        <span class="sb-sep">·</span>
        <span class="sb-item sb-size" onClick=${() => {
          const modes = ['formatted', 'bytes', 'chars'];
          state.config.fileSizeFormat.value = modes[(modes.indexOf(sizeFormat) + 1) % modes.length];
        }}>${getFileSize()}</span>
        <span class="sb-sep">·</span>
        <span class="sb-item sb-indent" onClick=${() => (state.modal.value = 'settings')}>${indentStr}</span>
      ` : html`<span class="sb-item sb-empty">No file</span>`}

      <span class="sb-spacer"></span>

      <span class="sb-item sb-nowrap" onClick=${() => toggle('wordWrap')}>${wordWrap}</span>
      <span class="sb-sep">·</span>
      <span class="sb-item" onClick=${() => toggle('minimap.enabled')}>${minimap}</span>
      <span class="sb-sep">·</span>
      <span class="sb-item" onClick=${() => toggle('lineNumbers')}>${lineNums}</span>
      <span class="sb-sep">·</span>
      <span class="sb-item sb-fontsize">${config.fontSize}px</span>
    </div>
  `;
}
