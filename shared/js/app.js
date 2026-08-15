import * as dom from '@domina/core';

const css = [
  './../css/colors.css',
  './../css/layout.css',
];

export function adoptStyleSheets (paths) {
  paths.forEach (path => dom.adoptStylesheet(path));
}
