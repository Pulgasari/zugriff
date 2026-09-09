import Picker from '/.shared/js/components/Picker.js';

function SortPicker ({ value, options, onChange }) {
  return html`<${Picker} look='segments' options=${options} value=${value} onChange=${onChange} />`;
}

export default SortPicker;
