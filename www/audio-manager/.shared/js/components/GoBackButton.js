// components/GoBackButton.js
// <${GoBackButton} go='podcasts' /> — a btn-icon back to the named route

export default function ({ go, ...rest }) {
  return html`<btn-icon icon='arrow-left' label='back' onClick=${() => zugriff.app.go(go)} ...${rest} />`;
}
