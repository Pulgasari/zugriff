// @cosmonaut/lsd/resolve.js

// Implements the "${field}" resolution cascade used by CODE templates.
// This is deliberately shape-based, not annotation-based: whether a
// TYPE/NODE field was ever given a ": Type" annotation makes no
// difference here. What matters is the actual runtime shape of the
// value sitting in that field once the parser has produced it:
//
//   - a Lexer token ({ type, value, ... }, "type" is a TKN name)  -> .value
//   - an AST node    ({ type, ... }, "type" is a block/RULE name) -> generate it -> its .code
//   - a bare array                                                -> ERROR: separator
//                                                                     must be given explicitly,
//                                                                     e.g. "${field, ', '}"
//   - anything else (string/number/boolean/null)                  -> used as-is
//
// Explicit dotted paths ("${identifier.value}", "${body.code}") bypass
// the cascade entirely: they're a deliberate escape hatch, walked
// literally and stringified directly, whatever is found there.
//
// Whether a field even HAD a ": Type" annotation in its block's NODE/TYPE
// declaration is irrelevant here - untyped fields resolve exactly the
// same way, because the decision is made from the value's own shape at
// generation time, not from a lookup table built out of annotations.

// :::::: Type registry - built once per LSD document

export function buildTypeRegistry (lsd) {
  const tokenTypeNames = new Set(lsd.tokens.map(t => t.name));

  const nodeTypeNames = new Set([
    ...lsd.grammar.blocks     .map(b => b.name),
    ...lsd.grammar.productions.map(p => p.name),
  ]);

  return { tokenTypeNames, nodeTypeNames };
}

// :::::: The resolution cascade for a single (already-dereferenced) value

export function resolveField (value, registry, generate, { fieldPathForErrors } = {}) {
  if (Array.isArray(value)) {
    const label = fieldPathForErrors ?? 'field';
    throw new Error(
      `[lsd] Field "${label}" resolves to a list; specify a separator explicitly, ` +
      `e.g. "\${${label}, ', '}".`
    );
  }

  if (value == null)                           return '';
  if (typeof value !== 'object')               return String(value); // raw literal tag / primitive
  if (registry.tokenTypeNames.has(value.type)) return value.value ?? '';
  if (registry. nodeTypeNames.has(value.type)) return generate(value);

  throw new Error(`[lsd] Cannot resolve field of unrecognized shape: ${JSON.stringify(value)}`);
}

// :::::: Explicit dotted-path walking (the ".value" / ".code" escape hatch)

export function resolvePath (node, path) {
  let current = node;
  for (const segment of path) {
    if (current === null || current === undefined) return current;
    current = current[segment];
  }
  return current;
}

// :::::: Template interpolation - "${field}", "${a.b}", "${field, 'sep'}"

export function interpolateTemplate (template, node, registry, generate) {
  return template.replace(/\$\{([^}]+)\}/g, (_, exprText) => {
    const [pathText, ...rest] = splitTopLevelComma(exprText);
    const path      = pathText.trim().split('.');
    const separator = rest.length > 0 ? parseStringLiteral(rest.join(',').trim()) : undefined;

    if (separator !== undefined) {
      const value = resolvePath(node, path);
      if (!Array.isArray(value)) {
        throw new Error(`[lsd] "\${${exprText}}" expects a list field, but "${pathText.trim()}" is not an array.`);
      }
      return value
        .map(el => resolveField(el, registry, generate, { fieldPathForErrors: pathText.trim() }))
        .join(separator);
    }

    if (path.length === 1) {
      const value = resolvePath(node, path);
      return resolveField(value, registry, generate, { fieldPathForErrors: pathText.trim() });
    }

    // explicit dotted path ("${identifier.value}", "${body.code}") -
    // deliberate escape hatch: no cascade, just stringify what's there
    const value = resolvePath(node, path);
    if (Array.isArray(value)) {
      throw new Error(`[lsd] "\${${exprText}}" resolves to a list; specify a separator, e.g. "\${${pathText.trim()}, ', '}".`);
    }
    return value === null || value === undefined ? '' : String(value);
  });
}

function splitTopLevelComma (text) {
  // this template syntax only ever has at most one comma (field, 'separator')
  const idx = text.indexOf(',');
  return idx === -1 ? [text] : [text.slice(0, idx), text.slice(idx + 1)];
}

function parseStringLiteral (text) {
  const match = text.match(/^['"](.*)['"]$/s);
  if (!match) throw new Error(`[lsd] Expected a quoted separator string, got: ${text}`);
  return match[1];
}

// :::::: Generator - resolves a node's own block + CODE template, recursively

export function makeGenerator (lsd, registry) {
  const blocksByName = Object.fromEntries(lsd.grammar.blocks.map(b => [b.name, b]));

  function generate (node) {
    const block = blocksByName[node.type];
    if (!block) throw new Error(`[lsd] No block found for node type "${node.type}".`);

    if (!block.codeTemplate) {
      throw new Error(
        `[lsd] Block "${block.name}"${block.fullName ? ` (${block.fullName})` : ''} has no CODE template ` +
        `and cannot be generated directly. Reference a specific field instead, e.g. "\${field.someProperty}".`
      );
    }

    return interpolateTemplate(block.codeTemplate, node, registry, generate);
  }

  return generate;
}
