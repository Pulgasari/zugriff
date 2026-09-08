// .shared/js/modules/hotkeys.js
// keyboard shortcuts behind zugriff.app.hotKeys, declared as a map of combo -> spec:
//
//   app.hotKeys = {
//     'ctrl + s'    : { action: 'save' },                    // spaces around + are optional
//     'space'       : { action: 'toggle-play', when: hasPlayer },
//     'arrow-left'  : { action: 'skip-back',   when: hasPlayer },
//   };
//
// a spec's `action` is an action id resolved through the app's action registry (so a
// shortcut and a button share one behaviour), or a callback. combos are modifier-order
// independent ('shift+ctrl+k' === 'ctrl+shift+k'); use the keywords space / arrow-left /
// arrow-right / arrow-up / arrow-down / escape / … (a bare ' ' is NOT the spacebar). typing
// in an input/textarea is left alone unless the spec is { global:true } or the combo holds a
// modifier. `when` gates a binding behind a condition; `preventDefault` defaults to true.

const MOD_ORDER = ['ctrl', 'alt', 'shift', 'meta'];

// friendly combo keyword -> the canonical key comboFromEvent produces
const KEYWORDS = {
  'space'       : 'space',
  'arrow-left'  : 'arrowleft',
  'arrow-right' : 'arrowright',
  'arrow-up'    : 'arrowup',
  'arrow-down'  : 'arrowdown',
  'esc'         : 'escape',
  'del'         : 'delete',
  'return'      : 'enter',
};

// split on '+', trim each part (so 'ctrl + s' works), map friendly keywords to their
// canonical key, then order modifiers so combos compare regardless of order
const normalize = combo => String(combo)
  .toLowerCase()
  .split('+')
  .map(part => part.trim())
  .filter(Boolean)
  .map(part => KEYWORDS[part] ?? part)
  .sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b))
  .join('+');

const comboFromEvent = event => {
  const parts = [];
  if (event.ctrlKey)  parts.push('ctrl');
  if (event.altKey)   parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey)  parts.push('meta');
  const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
  if (!MOD_ORDER.includes(key)) parts.push(key);
  return normalize(parts.join('+'));
};

const isEditable = el =>
  !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

// `actions` (optional) is the app's action registry, so a string action is an action id
export function createHotkeys (actions) {
  const bindings = new Map();   // combo -> spec { action, when, global, preventDefault }

  const resolve = action =>
      typeof action === 'function'          ? action
    : typeof action === 'string' && actions ? event => actions.run(action, event)
    : null;

  const onKeydown = event => {
    const spec = bindings.get(comboFromEvent(event));
    if (!spec) return;

    // don't hijack plain typing unless the spec opts in, or a modifier is held
    if (!spec.global && !(event.ctrlKey || event.metaKey || event.altKey) && isEditable(event.target)) return;
    if (spec.when && !spec.when()) return;

    const run = resolve(spec.action);
    if (!run) return;
    if (spec.preventDefault !== false) event.preventDefault();
    run(event);
  };

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown);

  const api = {
    // declare the whole map: { 'ctrl + s': { action, when, global, preventDefault }, … }.
    // a bare action id / callback is accepted as the value shorthand.
    define (map = {}) {
      for (const [combo, spec] of Object.entries(map)) {
        bindings.set(normalize(combo), spec && typeof spec === 'object' ? spec : { action: spec });
      }
      return api;
    },
    remove (combo) { for (const c of [].concat(combo)) bindings.delete(normalize(c)); return api; },
    list ()    { return [...bindings.keys()]; },
    destroy () {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
      bindings.clear();
    },
  };
  return api;
}

export default createHotkeys;
