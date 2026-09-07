function Scrim ({ children }) {
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      ${children}
    </div>`;
}

export default Scrim;
