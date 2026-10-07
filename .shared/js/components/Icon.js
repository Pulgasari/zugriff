// shared/js/components/Icon.js
// <svg-icon> resolves a bare name through the @aufbau/svg aliases itself

// a bare number means pixels — call sites pass both 32 and "32"
const length = value =>
  value == null || value === '' ? undefined
  : /^-?\d*\.?\d+$/.test(String(value)) ? `${value}px`
  : value;

function Icon ({ name, size, ...rest }) {
  return html`
    <svg-icon
      class='icon'
      icon=${name}
      size=${length(size)}
      ...${rest}
    ></svg-icon>`;
}

export       { Icon };
export default Icon;

