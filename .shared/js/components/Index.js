// components/Index.js

import { html } from '@aufbau/kits/preact-htm';

function Index ({
  viewmode,
  itemLook,
  itemShape,
  itemSize,
  itemSizeMax,
  itemSizeMin,
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
    >${children}</aufbau-index>
  `;
}

export       { Index };
export default Index;
