// components/ViewHeader.js
// the predefined head of a view: back, title, tools. a view can write its own
// <header> instead, both sit directly in the <app-view>.
//
//   <${ViewHeader} back='podcasts' title=${podcast.title} tools=${actions} />
//   <${ViewHeader} back=${{ label: 'Back', onClick }} />
//
// back is the name of a view to go to, or the props of the back button

function ViewHeader ({ back, title, tools, children, ...rest }) {
  const backProps = typeof back === 'string' ? { onClick: () => zugriff.app.go(back) } : back;

  return html`
    <header ...${rest}>
      ${back  && html`<btn-icon class='ViewBack' icon='arrow-left' label='back' ...${backProps} />`}
      ${title && html`<h1>${title}</h1>`}
      ${tools && html`<div class='ViewTools'>${tools}</div>`}
      ${children}
    </header>
  `;
}

export { ViewHeader };
export default ViewHeader;
