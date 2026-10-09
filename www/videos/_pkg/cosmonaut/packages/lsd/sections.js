// @cosmonaut/lsd/sections.js

// Splits raw LSD source into its top-level areas (META / TKN / RULE / HL)
// plus the "#### Name" blocks nested inside the RULE area.

const BARE_META_NAME = /^META\s*::\s*(\S+)$/;
const META_VOCAB     = /^META\s+(PROP|LIST|TABLE)\b/;
const TOP_LEVEL_RULE = /^RULE\s*::\s*\S+\s*==/;

const isLabelLine    = line => line.startsWith('####');
const isPlainComment = line => line.startsWith('#') && !line.startsWith('####');

export function splitSections (source) {
  const sections = { HL: [], META: [], RULE: [], TKN: [] };
  const blocks   = [];

  let mode         = null;
  let currentBlock = null;
  let pendingLabel = null;

  const closeBlock = () => {
    if (currentBlock) blocks.push(currentBlock);
    currentBlock = null;
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();

    if (line === '' || isPlainComment(line)) continue;

    if (isLabelLine(line)) {
      pendingLabel = line.replace(/^#+\s*/, '').trim();
      continue;
    }

    if (META_VOCAB.test(line))   { mode = 'META'; closeBlock(); sections.META.push(rawLine); continue; }
    if (line.startsWith('TKN ')) { mode = 'TKN';  closeBlock(); sections.TKN .push(rawLine); continue; }
    if (line.startsWith('HL '))  { mode = 'HL';   closeBlock(); sections.HL  .push(rawLine); continue; }

    if (TOP_LEVEL_RULE.test(line)) { mode = 'RULE'; closeBlock(); sections.RULE.push(rawLine); continue; }

    if (mode !== 'RULE' && (line.startsWith('RULE ') || BARE_META_NAME.test(line))) {
      mode = 'RULE';
    }

    if (mode === 'RULE') {
      const bareMeta = line.match(BARE_META_NAME);

      if (bareMeta) {
        closeBlock();
        currentBlock = { fullName: pendingLabel, name: bareMeta[1], lines: [] };
        pendingLabel = null;
        continue;
      }

      if (currentBlock) currentBlock.lines.push(rawLine);
      else              sections.RULE.push(rawLine);

      continue;
    }

    if (mode === 'META') sections.META.push(rawLine);
  }

  closeBlock();

  return { ...sections, BLOCKS: blocks };
}
