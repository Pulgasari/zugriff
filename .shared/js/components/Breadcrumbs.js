// Breadcrumbs.js

function Breadcrumbs ({ path, segments }) {
  segments ??= path?.split('/') ?? [];
  
  return html`
    <nav class='breadcrumbs'>
      ${segments.map((seg, i) => html`
        <span key=${i}>
          ${i > 0 && html`<span class="crumb-sep">/</span>`}
          <span class='crumb'>${seg}</span>
        </span>
      `)}
    </nav>
  `;
}

export default Breadcrumbs;
