// shared/js/components/GhostButton.js

import Button from './Button.js';

export default function GhostButton (props) {
  props.className = 'ghost';
  return Button(props);
}
