// components/Index.js

import { html } from './../vendors.js';

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
    <data-index
      class=${klass}
      gap=${gap}
      item-shape=${itemShape}
      item-look=${itemLook}
      item-size=${itemSize}
      item-size-max=${itemSizeMax}
      item-size-min=${itemSizeMin}
      viewmode=${viewmode}
      ...${rest}
    >${children}</data-index>
  `;
}

export       { Index };
export default Index;
