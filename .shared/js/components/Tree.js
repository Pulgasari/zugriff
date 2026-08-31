// shared/js/components/Tree.js
// a preact wrapper around <aufbau-tree>. the element is autoloaded lazily, so a
// plain `nodes=${data}` from a vdom lib would be stringified into an attribute
// before the element upgrades — this sets the `nodes` property imperatively once
// the element is defined, and forwards its select/toggle events as callbacks.
//
//   <${Tree} nodes=${data}
//            onSelect=${e => open(e.detail.value)}
//            onToggle=${e => persist(e.detail.value, e.detail.expanded)} />

import { html } from '@aufbau/kits/preact-htm';
import { useRef, useEffect } from '@aufbau/kits/preact-htm';

function Tree ({ nodes, onSelect, onToggle, class: klass }) {
  const ref = useRef(null);

  // feed the data as a property (never an attribute), waiting for the lazily
  // registered element to upgrade first
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (customElements.get('aufbau-tree')) { el.nodes = nodes; return; }
    let alive = true;
    customElements.whenDefined('aufbau-tree').then(() => {
      if (alive && ref.current) ref.current.nodes = nodes;
    });
    return () => { alive = false; };
  }, [nodes]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const select = e => onSelect?.(e);
    const toggle = e => onToggle?.(e);
    el.addEventListener('aufbau-tree-select', select);
    el.addEventListener('aufbau-tree-toggle', toggle);
    return () => {
      el.removeEventListener('aufbau-tree-select', select);
      el.removeEventListener('aufbau-tree-toggle', toggle);
    };
  }, [onSelect, onToggle]);

  return html`<aufbau-tree ref=${ref} class=${klass}></aufbau-tree>`;
}

export       { Tree };
export default Tree;
