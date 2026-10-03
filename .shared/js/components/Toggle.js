// components/Toggle.js
// wraps <input-bool look='switch'>.

function Toggle ({ value = false, onChange, label, look = 'switch' }) {
  const change = event => onChange?.(Boolean(event.target?.checked));

  return html`
    <label class='toggle'>
      <input-bool look=${look} checked=${value} onChange=${change}></input-bool>
      ${label && html`<span>${label}</span>`}
    </label>
  `;
}

export       { Toggle };
export default Toggle;
