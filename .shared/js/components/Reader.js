// components/Reader.js

function Reader ({ format, id, text, transform, onClick, ...rest }) {
  return html`
    <aufbau-reader 
      format=${format}
      id=${id}
      raw=${text}
      transform=${transform}
      onClick=${onClick}
      ...${rest}
      >
    </aufbau-reader>
  `;
}

export       { Reader };
export default Reader;
