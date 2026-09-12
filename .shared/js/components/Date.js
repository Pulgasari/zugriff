// components/Date.js

function Date ({ value }) {
  value = zugriff.fmt.date(value);
  
  return html`
    <span class='date'>
      ${value}
    </span>
  `;
}
