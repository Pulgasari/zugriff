// components/Reader.js

function Reader ({ format, id, text, transform, onClick, ...rest }) {
  return html`
    <output-md
      format=${format}
      id=${id}
      raw=${text}
      transform=${transform}
      onClick=${onClick}
      ...${rest}
      >
    </output-md>
  `;
}

export       { Reader };
export default Reader;
