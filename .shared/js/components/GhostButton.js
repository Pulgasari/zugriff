// shared/js/components/GhostButton.js

import Button from './Button.js';

function GhostButton (props) {
  props.className = 'ghost';
  return Button(props);
}

export       { GhostButton };
export default GhostButton;
