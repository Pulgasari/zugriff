// components/GoBackButton.js

export default function GoBackButton ({ go, ...rest }) {
  return html`
    <${Button} 
      icon='arrow-left' 
      onClick=${() => app.go('podcasts')}
      ...${rest}
    />
  `;
}
