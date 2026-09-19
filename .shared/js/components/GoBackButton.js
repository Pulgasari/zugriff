// components/GoBackButton.js

import Button from './Button.js';

export default function ({ go, ...rest }) {
  return html`
    <${Button} 
      icon='arrow-left' 
      onClick=${() => app.go(go)}
      ...${rest}
    />
  `;
}
