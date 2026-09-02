// .shared/js/app/router.js
// a tiny query-param router bound to app.state.route. an app declares its routes
// once (id + component, plus whatever nav metadata it wants), the router resolves
// the initial route from ?<param>= and keeps the url in sync on navigation. it
// rewires app.setRoute to go through here, so "open a route" stays one call
// (app.setRoute('edit')) and the url follows.
//
//   const router = createRouter(app, { routes, param: 'mode', fallback: 'view' });
//   html`<${router.Outlet} />`               // renders the active route's component
//   router.routes.map(r => … r.id … )        // build a nav; app.state.route is active
//   app.setRoute('edit')                      // navigate (updates state + url)

import { html } from './../vendors.js';

export function createRouter (app, { routes, param = 'route', fallback } = {}) {
  // accept an array ([{ id, component, … }]) or a map ({ id: { component, … } })
  const list = Array.isArray(routes)
    ? routes
    : Object.entries(routes).map(([id, route]) => ({ id, ...route }));

  const byId  = new Map(list.map(route => [route.id, route]));
  const valid = id => byId.has(id);

  const writeUrl = id => {
    if (typeof location === 'undefined') return;
    const url = new URL(location.href);
    if (url.searchParams.get(param) === id) return;
    url.searchParams.set(param, id);
    history.replaceState(null, '', url);
  };

  const go = id => {
    if (!valid(id)) return;
    app.state.route = id;
    writeUrl(id);
  };

  // initial route: a valid ?param= wins, else the caller's fallback, else the first
  const fromUrl = typeof location !== 'undefined' && new URLSearchParams(location.search).get(param);
  const initial = valid(fromUrl) ? fromUrl : (fallback ?? list[0]?.id ?? null);

  if (initial != null) { app.state.route = initial; writeUrl(initial); }

  // route-opening is one call everywhere: app.setRoute keeps the url in sync now
  app.setRoute = go;
  app.routes   = list;

  const Outlet = () => {
    const route = byId.get(app.state.route);
    return route?.component ? html`<${route.component} />` : null;
  };

  return { routes: list, go, current: () => byId.get(app.state.route), Outlet };
}

export default createRouter;
