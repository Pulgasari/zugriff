// @cosmonaut/lsd/meta.js

// Parses META PROP / META LIST / META TABLE lines into a plain data
// structure. TABLE parsing spans multiple lines (schema block + row
// block), so it consumes the full META section's raw lines rather than
// operating line-by-line like PROP/LIST.

export function parseMeta (metaLines) {
  const props  = {};
  const lists  = {};
  const tables = {};

  const source = metaLines.join('\n');

  // META PROP name == <expr text> (expr text left as a raw string for now -
  // shares the same open questions as grammar.js's RULE expressions)
  for (const match of source.matchAll(/^META PROP\s*::\s*(\S+)\s*==\s*(.+)$/gm)) {
    const [, name, exprText] = match;
    props[name] = exprText.trim();
  }

  // META LIST name == word word word ...
  for (const match of source.matchAll(/^META LIST\s*::\s*(\S+)\s*==\s*(.+)$/gm)) {
    const [, name, wordsText] = match;
    lists[name] = wordsText.trim().split(/\s+/);
  }

  // META TABLE name == ( field [is Type[*]] ... ) { rows... }
  for (const match of source.matchAll(/^META TABLE\s*::\s*(\S+)\s*==\s*\(([\s\S]*?)\)\s*\{([\s\S]*?)^\}/gm)) {
    const [, name, schemaText, rowsText] = match;
    tables[name] = parseTable(schemaText, rowsText);
  }

  return { props, lists, tables };
}

// :::::: Table Schema
// One field per line: "name" or "name is Type" or "name is Type*".
// - "Type" defaults to "String" when omitted.
// - A trailing "*" on the type marks this field as the row's LIST column,
//   fed from that row's trailing "( a b c )" - mirrors the "*" = many0
//   convention already used in RULE patterns (e.g. "Statement*").
// - At most one field per table may be marked as a list.

function parseTableSchema (schemaText) {
  const fields = schemaText
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\S+)(?:\s+is\s+(\S+))?$/);
      if (!match) throw new Error(`[lsd] Malformed table field: "${line}"`);

      const [, fieldName, typeText] = match;
      const isList = typeText?.endsWith('*') ?? false;
      const type   = (isList ? typeText.slice(0, -1) : typeText) || 'String';

      return { name: fieldName, type, isList };
    });

  const listFields = fields.filter(f => f.isList);
  if (listFields.length > 1) {
    throw new Error(
      `[lsd] Table schema declares more than one list field (${listFields.map(f => f.name).join(', ')}); ` +
      `only one "Type*" field per table is supported.`
    );
  }

  return fields;
}

function parseTable (schemaText, rowsText) {
  const fields    = parseTableSchema(schemaText);
  const listField = fields.find(f => f.isList) ?? null;

  const rows = rowsText
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => parseTableRow(line, fields, listField));

  return { fields, rows };
}

function parseTableRow (line, fields, listField) {
  const listMatch    = line.match(/\(([^)]*)\)\s*$/);
  const scalarPart   = listMatch ? line.slice(0, listMatch.index).trim() : line;
  const scalarValues = scalarPart.split(/\s+/).filter(Boolean);

  const row          = {};
  const scalarFields = fields.filter(f => f !== listField);

  scalarFields.forEach((field, i) => {
    row[field.name] = castValue(scalarValues[i], field.type);
  });

  if (listField) {
    if (!listMatch) {
      throw new Error(`[lsd] Row "${line}" is missing the "( ... )" list required by field "${listField.name}".`);
    }
    row[listField.name] = listMatch[1].trim().split(/\s+/).filter(Boolean);
  } else if (listMatch) {
    throw new Error(
      `[lsd] Row "${line}" has a trailing "( ... )" list, but no field in the schema is marked ` +
      `as a list (e.g. "symbols is String*").`
    );
  }

  return row;
}

function castValue (raw, type) {
  if (raw === undefined)  return raw;
  if (type === 'Number')  return Number(raw);
  if (type === 'Boolean') return raw === 'true';
  return raw; // String or unknown/custom type name - kept as-is
}

