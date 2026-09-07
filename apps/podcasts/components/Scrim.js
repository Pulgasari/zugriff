// apps/podcasts/components/Scrim.js
// the modal backdrop — clicking outside the content closes the current dialog.

const app = zugriff.app;
const { dialog } = app.ui;

export default function Scrim ({ children }) {
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      ${children}
    </div>`;
}
