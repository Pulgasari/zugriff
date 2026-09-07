// .shared/js/modules/hotkeys.js
// keyboard shortcuts behind zugriff.app.hotkeys. a binding maps a key combo to a
// callback OR an action id (string) — resolved through the app's action registry, so
// a shortcut and a button can share one behaviour:
//
//   app.hotkeys.bind('ctrl+r', 'refresh-episodes');   // fire an action by id
//   app.hotkeys.bind(' ', () => app.player.toggle());  // or a callback
//   app.hotkeys.bind(['j', 'arrowdown'], 'next');      // one or many combos
//
// combos are modifier-order-independent ('shift+ctrl+k' === 'ctrl+shift+k'); ' ' is
// 'space'. typing in an input/textarea is left alone unless the binding is { global:true }
// or uses a modifier. scopes gate a set of bindings behind a condition.

const MOD_ORDER = ['ctrl', 'alt', 'shift', 'meta'];

// split on '+', trim each part (so 'ctrl + r' works) and map a lone space to 'space'
// (a bare ' ' is the spacebar), then order modifiers so combos compare regardless of order
const normalize = combo => String(combo)
  .toLowerCase()
  .split('+')
  .map(part => part.trim() === '' ? 'space' : part.trim())
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

// `actions` (optional) is the app's action registry, so a string target is an action id
export function createHotkeys (actions) {
  const bindings = new Map();   // combo -> { target, options }
  let activeScope = null;

  const resolve = target =>
      typeof target === 'function'                 ? target
    : typeof target === 'string' && actions        ? event => actions.run(target, event)
    : null;

  const onKeydown = event => {
    const binding = bindings.get(comboFromEvent(event));
    if (!binding) return;
    const { options } = binding;

    // don't hijack plain typing unless the binding opts in, or a modifier is held
    if (!options.global && !(event.ctrlKey || event.metaKey || event.altKey) && isEditable(event.target)) return;

    if (activeScope) {
      if (!activeScope.enabled) return;
      if (activeScope.condition && !activeScope.condition()) return;
    }
    if (options.when && !options.when()) return;

    const run = resolve(binding.target);
    if (!run) return;
    if (options.preventDefault !== false) event.preventDefault();
    run(event);
  };

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown);

  const api = {
    /** bind one combo (or an array of them) to a callback or an action id */
    bind (combo, target, options = {}) {
      for (const c of [].concat(combo)) bindings.set(normalize(c), { target, options });
      return api;
    },
    unbind (combo) {
      for (const c of [].concat(combo)) bindings.delete(normalize(c));
      return api;
    },
    /** a named scope whose bindings only fire while it is enabled (and its condition holds) */
    scope (name) {
      const scope = {
        name, enabled: false,
        enable  ()   { scope.enabled = true;  activeScope = scope; return scope; },
        disable ()   { scope.enabled = false; if (activeScope === scope) activeScope = null; return scope; },
        when    (fn) { scope.condition = fn; return scope; },
      };
      return scope;
    },
    list ()    { return [...bindings.keys()]; },
    destroy () {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
      bindings.clear();
    },
  };
  return api;
}

export default createHotkeys;
