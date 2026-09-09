


const MIME = {
  txt:'text/plain', md:'text/markdown', markdown:'text/markdown', json:'application/json',
  html:'text/html', css:'text/css', js:'text/javascript', csv:'text/csv', xml:'application/xml',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
  svg:'image/svg+xml', avif:'image/avif', bmp:'image/bmp', ico:'image/x-icon', heic:'image/heic',
  pdf:'application/pdf', epub:'application/epub+zip',
  mp3:'audio/mpeg', ogg:'audio/ogg', flac:'audio/flac', m4a:'audio/mp4', wav:'audio/wav',
  mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime',
};
const mimeTypeOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? (MIME[name.slice(dot + 1).toLowerCase()] ?? '') : '';
};
