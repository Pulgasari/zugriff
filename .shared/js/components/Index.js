// shared/js/components/Index.js
// a thin preact wrapper around <aufbau-index> — the shared layout for every
// place an app lists like-for-like items (a library grid, a feed list, an icon
// gallery). the element owns the grid/list/gallery/masonry layout and the
// optional two-finger item-size resize; this just maps props to its attributes
// so call sites read as ordinary components.
//
//   <${Index} viewmode="grid" itemSize="180px" gap="1rem">
//     ${items.map(it => html`<aufbau-item …/>`)}
//   <//>

import { html } from '@aufbau/kits/preact-htm';

function Index ({
  viewmode,
  itemSize,
  itemShape,
  itemLook,
  itemSizeMin,
  itemSizeMax,
  gap,
  class: klass,
  children,
  ...rest
}) {
  return html`
    <aufbau-index
      viewmode=${viewmode}
      item-size=${itemSize}
      item-shape=${itemShape}
      item-look=${itemLook}
      item-size-min=${itemSizeMin}
      item-size-max=${itemSizeMax}
      gap=${gap}
      class=${klass}
      ...${rest}
    >${children}</aufbau-index>`;
}

export { Index };
export default Index;
