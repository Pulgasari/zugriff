// .shared/js/modules/actions.js
// the app-wide action registry behind zugriff.app.actions. an action is a named
// callback the app exposes as its vocabulary of "things it can do" — refreshEpisodes,
// togglePlay, openSettings — so ui, hotkeys and any other caller fire behaviour by id
// instead of importing each handler. it cuts the boilerplate almost every app repeats
// and gives hotkeys a stable target.
//
//   app.actions.add('refresh-episodes', () => {...});   // register
//   app.actions.refreshEpisodes = () => {...};          // same, property form
//   app.actions = { refreshEpisodes, refreshPodcasts }; // merge (handled by the app)
//   app.actions.run('refresh-episodes');                // fire
//   app.actions.refreshEpisodes();                      // fire, property form
//
// ids are canonical across kebab / camel / snake (CanonicalMap), so 'refresh-episodes',
// 'refreshEpisodes' and 'refresh_episodes' are the one action.

import CanonicalMap from '@pulgasari/canonicalmap';

// the api methods live on the object the Proxy wraps; any other key falls through to
// the map, so a get returns the action fn and a set registers one.
const RESERVED = new Set(['add', 'remove', 'get', 'has', 'run', 'list', 'map']);

export function createActions (source) {
  const map = new CanonicalMap(source);

  const api = {
    map,
    add    : (id, fn) => (map.set(id, fn), proxy),
    remove : id => (map.delete(id), proxy),
    get    : id => map.get(id),
    has    : id => map.has(id),
    run    : (id, ...args) => map.get(id)?.(...args),
    list   : () => [...map.keys()],
  };

  const proxy = new Proxy(api, {
    get (target, prop) {
      if (typeof prop !== 'string' || RESERVED.has(prop)) return target[prop];
      return map.get(prop);
    },
    set (target, prop, value) {
      if (RESERVED.has(prop)) { target[prop] = value; return true; }
      map.set(prop, value);
      return true;
    },
    has (target, prop) { return RESERVED.has(prop) || map.has(prop); },
    deleteProperty (_, prop) { return map.delete(prop); },
    ownKeys ()  { return [...map.keys()]; },
    getOwnPropertyDescriptor () { return { enumerable: true, configurable: true }; },
  });

  return proxy;
}

export default createActions;
