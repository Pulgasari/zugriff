// shared/js/components/hljs.js
//
// highlight.js core plus lazy language registration — only the languages an
// app actually renders get fetched.

import hljs from 'highlight.js';

const registered = new Set();

// languages highlight.js does not ship under the name we use for them
const ALIAS = {
  toml : 'ini',
  html : 'xml',
};

export async function ensureLang (lang) {
  if (!lang || lang === 'plaintext' || registered.has(lang)) return;
  registered.add(lang);
  try {
    const mod = await import('highlight.js/languages/' + (ALIAS[lang] ?? lang));
    hljs.registerLanguage(lang, mod.default);
  } catch (error) {
    registered.delete(lang);
    console.warn(`[hljs] no language "${lang}":`, error);
  }
}

export { hljs };
