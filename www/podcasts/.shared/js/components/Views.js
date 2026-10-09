// components/Views.js
// app.views as the <app-view>s of #app. a view with a route always renders, a detail
// view once app.go() handed it params; the params are its props. a view's module is
// imported on its first render. attributes given to <Views> go on every <app-view>.
//
//   <app-area name='main'>
//     <${Views} transition-on='glide' />
//   </app-area>

import { useSlot } from './Slot.js';

// 'LatestView' or a component is short for { view }
const entryOf = value => value !== null && typeof value === 'object' ? value : { view: value };

function ViewContent ({ name, entry }) {
  const params    = zugriff.app.params.value[name];
  const Component = useSlot('view', entry.view);
  if (!Component || (!entry.route && params === undefined)) return null;
  return html`<${Component} ...${params ?? {}} />`;
}

function Views (attributes) {
  return Object.entries(zugriff.app.views).map(([name, value]) => {
    const entry = entryOf(value);
    return html`
      <app-view key=${name} name=${name} route=${entry.route} ...${attributes}>
        <${ViewContent} name=${name} entry=${entry} />
      </app-view>
    `;
  });
}

export { Views };
export default Views;
