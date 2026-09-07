// apps/code/modules/config.js
// the app's chrome / panel configuration — plain scalars seeded onto app.state.config
// (a deep-signal subtree, persisted per app.persist). theme/font/dir live on the
// shared base state, not here.

export const DEFAULTS = {
  disableAndroidKeyboard : true,          // suppress the native keyboard while editing
  fileSizeFormat         : 'formatted',   // 'formatted' | 'bytes' | 'chars'
  fontSize               : 12,            // app chrome font size (drives --fontSize)
  showBrowser            : false,
  showKeyboard           : true,
  showStatusbar          : true,
  showToolbar            : true,
  commitPrompt           : false,         // ask for a commit message on GitHub saves
};

export default DEFAULTS;
