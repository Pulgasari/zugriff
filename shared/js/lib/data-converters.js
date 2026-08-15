// shared/js/lib/data-converters.js

import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { parse as tomlParse } from 'smol-toml';

// ── CSV ───────────────────────────────────────────────────────────────────────
export function csvParse(src) {
  let lines   = src.trim().split('\n');
  let headers = splitCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    let vals = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), coerce(vals[i]?.trim() ?? '')]));
  });
}

function splitCSVLine(line) {
  let result = [], re = /("([^"]*)"|([^,]*))(,|$)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    result.push(m[2] ?? m[3] ?? '');
    if (m[4] === '') break;
  }
  return result;
}

function coerce(v) {
  if (v === '')      return null;
  if (v === 'true')  return true;
  if (v === 'false') return false;
  let n = Number(v);
  return isNaN(n) ? v : n;
}

export function csvStringify(data) {
  let arr = Array.isArray(data) ? data : [data];
  if (!arr.length) return '';
  let keys = Object.keys(arr[0]);
  let esc  = v => {
    let s = v === null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
  };
  return [keys.join(','), ...arr.map(row => keys.map(k => esc(row[k])).join(','))].join('\n');
}

// ── JS Object ─────────────────────────────────────────────────────────────────
export let jsStringify = data =>
  'let data = ' + JSON.stringify(data, null, 2).replace(/"([^"]+)":/g, '$1:');

// ── re-exports ────────────────────────────────────────────────────────────────
export { yamlStringify, yamlParse, tomlParse };
export let jsonParse    = JSON.parse;
export let jsonStringify = data => JSON.stringify(data, null, 2);
export let tomlStringify = data => {
  // smol-toml has no stringify — manual simple impl for flat/nested objects
  function val(v) {
    if (typeof v === 'string')  return `"${v.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number')  return String(v);
    if (v === null)             return '""';
    return `"${String(v)}"`;
  }
  function section(obj, prefix = '') {
    let out = '';
    let simple  = Object.entries(obj).filter(([,v]) => typeof v !== 'object' || v === null);
    let complex = Object.entries(obj).filter(([,v]) => typeof v === 'object' && v !== null && !Array.isArray(v));
    let arrays  = Object.entries(obj).filter(([,v]) => Array.isArray(v));
    for (let [k, v] of simple)  out += `${k} = ${val(v)}\n`;
    for (let [k, v] of arrays) {
      if (v.every(x => typeof x !== 'object' || x === null))
        out += `${k} = [${v.map(val).join(', ')}]\n`;
      else
        for (let item of v) out += `\n[[${prefix}${k}]]\n` + section(item, prefix + k + '.');
    }
    for (let [k, v] of complex) out += `\n[${prefix}${k}]\n` + section(v, prefix + k + '.');
    return out;
  }
  let arr = Array.isArray(data) ? data : null;
  if (arr) return arr.map((item, i) => `[[items]]\n${section(item)}`).join('\n');
  return section(data);
};

// ── universal convert ─────────────────────────────────────────────────────────
let PARSERS = {
  csv  : csvParse,
  json : jsonParse,
  toml : tomlParse,
  yaml : yamlParse,
};
let STRINGIFIERS = {
  csv  : csvStringify,
  json : jsonStringify,
  toml : tomlStringify,
  yaml : data => yamlStringify(data, { indent: 2 }),
  js   : jsStringify,
};

export function convert(src, fromFmt, toFmt) {
  let data = PARSERS[fromFmt](src);
  return STRINGIFIERS[toFmt](data);
}