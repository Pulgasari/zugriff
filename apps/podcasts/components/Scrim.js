// apps/podcasts/components/Scrim.js
// the modal backdrop — clicking outside the content closes the current dialog.

const app = zugriff.app;

export default function Scrim ({ children }) {
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) app.state.dialog = null; }}>
      ${children}
    </div>`;
}
