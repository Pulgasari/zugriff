// shared/js/components/Icon.js
//
// thin wrapper around <aufbau-icon>. keeps the short alias names the apps
// have always used — anything containing a ':' is passed through to iconify
// untouched.

import { html } from '@aufbau/kits/preact-htm';

export const icons = {
  'add'               : 'material-symbols:add',
  'remove'            : 'material-symbols:remove',
  'arrow-down'        : 'material-symbols:arrow-downward',
  'arrow-left'        : 'material-symbols:arrow-back',
  'arrow-right'       : 'material-symbols:arrow-forward',
  'arrow-up'          : 'material-symbols:arrow-upward',
  'close'             : 'fa:close',
  'commands'          : 'material-symbols:keyboard-command-key',
  'copy'              : 'bx:copy',
  'copy-all'          : 'material-symbols:copy-all',
  'copy-file'         : 'material-symbols:file-copy',
  'cut'               : 'material-symbols:cut',
  'deselect'          : 'material-symbols:deselect',
  'download'          : 'mdi:download',
  'download-multiple' : 'mdi:download-multiple-outline',
  'enter'             : 'material-symbols:keyboard-return',
  'file'              : 'material-symbols:description',
  'folder'            : 'material-symbols:folder',
  'folder-open'       : 'material-symbols:folder-open',
  'fontsize'          : 'material-symbols:format-size',
  'join-lines'        : 'material-symbols:join-outline',
  'lineheight'        : 'material-symbols:format-line-spacing',
  'loading'           : 'svg-spinners:bars-scale-middle',
  'paste'             : 'material-symbols:content-paste',
  'previewer'         : 'material-symbols:preview',
  'redo'              : 'bx:redo',
  'refresh'           : 'material-symbols:refresh',
  'save'              : 'material-symbols:file-save',
  'search'            : 'material-symbols:search',
  'select-all'        : 'material-symbols:select-all',
  'settings'          : 'material-symbols:settings',
  'space'             : 'material-symbols:space-bar',
  'tab'               : 'bx:arrow-to-right',
  'tab-rtl'           : 'bx:arrow-to-left',
  'toggle-off'        : 'material-symbols:toggle-off',
  'toggle-on'         : 'material-symbols:toggle-on',
  'toolbar'           : 'material-symbols:widgets',
  'undo'              : 'bx:undo',
  'workspaces'        : 'grommet-icons:projects',
};

export const resolveIcon = name =>
  !name                 ? 'material-symbols:help'
  : name.includes(':')  ? name
  :                       icons[name] ?? 'material-symbols:help';

// size and color go in as attributes, not as inline custom properties:
// <aufbau-icon> rewrites --icon-size/--icon-color on every sync, so anything
// set on the style attribute would be wiped on the next repaint.
// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === ''      ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  : value;

// both `class` and `className` are accepted — the call sites use them mixed
export default function Icon ({ name, size, color, className, class: klass, onClick, title, style }) {
  return html`
    <aufbau-icon
      class=${['icon', className, klass].filter(Boolean).join(' ')}
      icon=${resolveIcon(name)}
      size=${length(size)}
      color=${color}
      style=${style}
      title=${title}
      onClick=${onClick}
    ></aufbau-icon>`;
}
