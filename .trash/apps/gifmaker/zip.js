// apps/gifmaker/zip.js
//
// a tiny ZIP reader/writer, no dependencies. writing uses the "store" method
// (no compression) — the frames are PNGs, already compressed, and the manifest
// is small, so there is nothing to gain and store keeps this file short.
// reading understands both stored and deflated entries (the latter via the
// browser's DecompressionStream), so a zip made elsewhere still imports.

// ── crc32 ────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32 (bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── write ────────────────────────────────────────────────────────────────────

/** build a ZIP Blob from [{ name, data:Uint8Array }] */
export function zipStore (entries) {
  const parts   = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc  = crc32(data);
    const size = data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true);         // version needed
    local.setUint16(6, 0x0800, true);     // flag: UTF-8 names
    local.setUint16(8, 0, true);          // method: store
    local.setUint16(10, 0, true);         // mod time
    local.setUint16(12, 0, true);         // mod date
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);      // compressed size
    local.setUint32(22, size, true);      // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);         // extra length

    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);   // central dir signature
    cen.setUint16(4, 20, true);           // version made by
    cen.setUint16(6, 20, true);           // version needed
    cen.setUint16(8, 0x0800, true);       // flag: UTF-8
    cen.setUint16(10, 0, true);           // method
    cen.setUint16(12, 0, true);
    cen.setUint16(14, 0, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint16(30, 0, true);           // extra
    cen.setUint16(32, 0, true);           // comment
    cen.setUint16(34, 0, true);           // disk number
    cen.setUint16(36, 0, true);           // internal attrs
    cen.setUint32(38, 0, true);           // external attrs
    cen.setUint32(42, offset, true);      // local header offset

    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const p of central) centralSize += p.length;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);    // end of central dir signature
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);

  return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)], { type: 'application/zip' });
}

// ── read ─────────────────────────────────────────────────────────────────────

async function inflateRaw (bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** parse a ZIP ArrayBuffer into [{ name, data:Uint8Array }] */
export async function unzip (buffer) {
  const view  = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // find the end-of-central-directory record, scanning back from the tail
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');

  const count  = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true); // central dir offset

  const out = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method   = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen  = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const cmtLen   = view.getUint16(ptr + 32, true);
    const local    = view.getUint32(ptr + 42, true);
    const name     = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    // the local header repeats name/extra lengths — data starts after them
    const lNameLen  = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const dataStart = local + 30 + lNameLen + lExtraLen;
    const comp      = bytes.subarray(dataStart, dataStart + compSize);

    const data = method === 0 ? comp.slice() : await inflateRaw(comp);
    out.push({ name, data });

    ptr += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}
