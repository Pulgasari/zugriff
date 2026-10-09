// components/Views.js
// app.views as the <app-view>s of #app. a view with a route always renders, a detail
// view once app.go() handed it params; the params are its props. a view's module is
// imported on its first render. attributes given to <Views> go on every <app-view>.
// with `lazy` a view with a route renders once it has been on screen, for an app of
// many views (apps/tools) that should not load them all up front. a view declared
// `transient` is in the dom only while it is on screen, leaving it unmounts it (a
// reader that closes its book, an editor that lets go of its canvas)
//
//   app.views = { reader: { route: '/reader', view: 'ReaderView', transient: true } };
//
//   <app-area name='main'>
//     <${Views} transition-on='glide' />
//   </app-area>

import { useRef } from './../vendors.js';

import { useSlot } from './Slot.js';

// 'LatestView' or a component is short for { view }
const entryOf = value => value !== null && typeof value === 'object' ? value : { view: value };

function ViewContent ({ name, entry, lazy }) {
  const app    = zugriff.app;
  const params = app.params.value[name];
  const seen   = useRef(false);
  if (app.current.value === name) seen.current = true;

  const shown     = entry.transient ? app.current.value === name
                  : entry.route     ? !lazy || seen.current
                  :                   params !== undefined;
  const Component = useSlot('view', shown ? entry.view : null);
  return Component ? html`<${Component} ...${params ?? {}} />` : null;
}

function Views ({ lazy = false, ...attributes }) {
  return Object.entries(zugriff.app.views).map(([name, value]) => {
    const entry = entryOf(value);
    return html`
      <app-view key=${name} name=${name} route=${entry.route} ...${attributes}>
        <${ViewContent} name=${name} entry=${entry} lazy=${lazy} />
      </app-view>
    `;
  });
}

export { Views };
export default Views;
