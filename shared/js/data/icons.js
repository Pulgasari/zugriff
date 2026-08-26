// shared/js/data/icons.js
//
// short names for the icons the apps reach for often, so a call site can say
// 'close' instead of 'fa:close'. anything containing a ':' is passed straight
// through to iconify, so this map never has to be complete.

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
  'reset'             : 'mdi:restore',
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

export const 
FALLBACK    = 'material-symbols:help',
resolveIcon = name => !name ? FALLBACK : name.includes(':') ? name : icons[name] ?? FALLBACK;     

export default icons;
