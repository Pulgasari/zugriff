// components/TOC.js

function TOC ({ selector='h1, h2, h3, h4, h5, h6', target, ...rest }) {
  return html`<aufbau-toc ...${{ selector, target, ...rest }}></aufbau-toc>`;
}

export       { TOC };
export default TOC;
