// components/Brand.js
// the app's icon (its own app.svg) and its name

function Brand ({ app, icon, name, ...rest }) {
  icon ??= app ? app.url + 'app.svg' : '';
  name ??= app?.config?.name ?? '';

  return html`
    <div id='app-brand' ...${rest}>
      <svg-icon icon=${icon} mode='image' />
      <span>${name}</span>
    </div>
  `;
}

export       { Brand };
export default Brand;
