// .shared/js/components/Slot.js

/*
renders one entry of a name map (app.views / app.dialogs)
and imports its module on first use. 

map values are either 'Name' (resolved through the given loader), 
'folder/Name' (resolved app-relative), 
or an already imported component.
*/

import { useState, useEffect } from 'preact/hooks';

const isFn     = sth => typeof sth === 'function';
const isString = sth => typeof sth === 'string';

const loaded  = new Map; // 'view:LatestView' -> component
const loading = new Map; // 'view:LatestView' -> promise

const resolve = (kind, name) => name.includes('/')
  ? zugriff.app.import(`${name}.js`)
  : zugriff.app[kind](name);

function useSlot (kind, entry) {
  const key = isString(entry) ? `${kind}:${entry}` : null;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!key || loaded.has(key)) return;
    let alive = true;
    const job = loading.get(key)
      ?? resolve(kind, entry).then(c => (loaded.set(key, c), loading.delete(key), c));
    loading.set(key, job);
    job.then(() => { if (alive) bump(n => n + 1); }).catch(zugriff.toast);
    return () => { alive = false; };
  }, [key]);

  if (isFn(entry)) return entry;   // already imported, nothing to load
  return key ? loaded.get(key) ?? null : null;
}

function Slot ({ map, name, load = 'view', fallback = null, ...props }) {
  const Component = useSlot(load, map?.[name]);
  return Component ? html`<${Component} ...${props} />` : fallback;
}

export default Slot;
