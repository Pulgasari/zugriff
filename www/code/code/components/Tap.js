// apps/code/components/Tap.js
// a single tappable icon that fires a command id.


const app = zugriff.app;

export default function Tap ({ cmd, icon, className }) {
  return html`
    <div class=${className || ''} onClick=${() => app.exec(cmd)}>
      <svg-icon icon=${icon} />
    </div>
  `;
}
