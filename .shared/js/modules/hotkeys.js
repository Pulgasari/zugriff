/*
das habe ich einfach aus einem alten projekt von mir copypasted.
ob es hier passt ist zu prüfen und ggf anzupassen usw.
also soll nur als grundlage dienen, nicht als strikte vorgabe.
*/

const normalize = (combo) => {
  return combo
  .toLowerCase()
  .replace(/\s+/g, '')
  .split('+')
  .sort((a, b) => {
    const order = ['ctrl', 'alt', 'shift', 'meta'];
    return order.indexOf(a) - order.indexOf(b);
  })
  .join('+');
};

let bindings    = new Map ();
let scopes      = new Map ();
let activeScope = null;

  // Core DOM event listener evaluating runtime keystroke mappings
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', event => {
      const parts: string[] = [];
      if (event.ctrlKey)  parts.push('ctrl');
      if (event.altKey)   parts.push('alt');
      if (event.shiftKey) parts.push('shift');
      if (event.metaKey)  parts.push('meta');
      parts.push(event.key.toLowerCase());
  
      const combo = normalize(parts.join('+'));
      const binding = bindings.get(combo);
      if (!binding) return;
  
      const { callback, options } = binding;
  
      // Scope boundary validation
      if (activeScope) {
        if (!activeScope.enabled) return;
        if (activeScope.condition && !activeScope.condition()) return;
      }
  
      // Custom runtime condition rule guard validation
      if (options.when && !options.when()) return;
  
      event.preventDefault();
      callback(event);
    });
  }
  
export default {
  register (combo, callback, options = {}) {
    const key = normalize(combo);
    bindings.set(key, { callback, options });
  },
  unregister (combo) {
    bindings.delete(normalize(combo));
  },
  createScope (name) {
    const scope = {
      name,
      enabled: false,
      enable  ()   { this.enabled = true; activeScope = this; },
      disable ()   { this.enabled = false; if (activeScope === this) activeScope = null; },
      when    (fn) { this.condition = fn; return this; }
    };
    scopes.set(name, scope);
    return scope;
  }
};
