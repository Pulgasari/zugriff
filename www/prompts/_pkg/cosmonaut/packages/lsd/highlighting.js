// @cosmonaut/lsd/highlighting.js

export function parseHighlighting (hlLines) {
  const scopes = {};

  for (const line of hlLines) {
    //const match = line.match(/^HL\s+(\S+)\s*==\s*(.+)$/);
    //const match = line.match(/^HL\s*::\s*(\S+)\s*==\s*(.+)$/);
    const match = line.match(/^HL\s*::\s*(\S+)\s*==\s*`([^`]+)`$/);
    //const match = line.match(/^HL\s+(\S+)\s*==\s*`([^`]+)`$/);
    if (!match) throw new Error(`[lsd] Malformed HL line: "${line}"`);
    const [, tokenName, scope] = match;
    scopes[tokenName] = scope;
  }

  return scopes;
}

/*
?????

// vorher:
function extractLiteralPrefix (regexSource) {

// nachher:
export function extractLiteralPrefix (regexSource) {
*/
