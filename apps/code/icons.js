// apps/code/icons.js
//
// the code editor uses a lot of short, editor-flavoured icon aliases
// ('capslock', 'move-lines-down', 'sort-lines' …) that the shared icon map
// doesn't carry. rather than push app-specific names into shared/js/data, the
// aliases live here and components/Icon.js resolves them to their iconify name
// before handing off to the shared <Icon>. anything already an iconify id
// (contains ':') or unknown is passed straight through.

export const aliases = {
  'add'                 : 'material-symbols:add',
  'remove'              : 'material-symbols:remove',
  'arrow-down'          : 'material-symbols:arrow-downward',
  'arrow-left'          : 'material-symbols:arrow-back',
  'arrow-right'         : 'material-symbols:arrow-forward',
  'arrow-up'            : 'material-symbols:arrow-upward',
  'backspace'           : 'material-symbols:backspace',
  'blockindent'         : 'material-symbols:keyboard-tab',
  'blockoutdent'        : 'material-symbols:keyboard-tab-rtl',
  'capslock'            : 'material-symbols:keyboard-capslock',
  'close'               : 'mdi:close',
  'commands'            : 'material-symbols:keyboard-command-key',
  'copy'                : 'bx:copy',
  'copy-all'            : 'material-symbols:copy-all',
  'copy-file'           : 'material-symbols:file-copy',
  'copy-lines-down'     : 'material-symbols:move-down',
  'copy-lines-up'       : 'material-symbols:move-up',
  'cut'                 : 'material-symbols:cut',
  'deselect'            : 'material-symbols:deselect',
  'enter'               : 'material-symbols:keyboard-return',
  'join-lines'          : 'material-symbols:join-outline',
  'keyboard'            : 'tdesign:keyboard',
  'move-lines-down'     : 'material-symbols:text-select-move-down',
  'move-lines-up'       : 'material-symbols:text-select-move-up',
  'move-selection-down' : 'material-symbols:move-selection-down',
  'move-selection-up'   : 'material-symbols:move-selection-up',
  'paste'               : 'material-symbols:content-paste',
  'previewer'           : 'material-symbols:preview',
  'redo'                : 'bx:redo',
  'refresh'             : 'material-symbols:refresh',
  'save'                : 'material-symbols:file-save',
  'search'              : 'material-symbols:search',
  'select-all'          : 'material-symbols:select-all',
  'settings'            : 'material-symbols:settings',
  'shift'               : 'material-symbols:shift',
  'sort-lines'          : 'material-symbols:reorder',
  'space'               : 'material-symbols:space-bar',
  'split-line'          : 'material-symbols:split-scene-outline',
  'tab'                 : 'bx:arrow-to-right',
  'tab-rtl'             : 'bx:arrow-to-left',
  'toggle-off'          : 'material-symbols:toggle-off',
  'toggle-on'           : 'material-symbols:toggle-on',
  'toolbar'             : 'material-symbols:widgets',
  'undo'                : 'bx:undo',
  'lineheight'          : 'material-symbols:format-line-spacing',
  'fontsize'            : 'material-symbols:format-size',
  'workspaces'          : 'grommet-icons:projects',
  'file'                : 'material-symbols:description',
  'folder'              : 'material-symbols:folder',
  'folder-open'         : 'material-symbols:folder-open',
};

// an iconify id passes through; a known alias is resolved; anything else is left
// for the shared resolver (which has its own map + fallback).
export const resolve = name =>
  !name ? name : name.includes(':') ? name : (aliases[name] ?? name);

export default resolve;
