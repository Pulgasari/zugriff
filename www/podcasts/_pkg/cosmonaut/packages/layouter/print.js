// @cosmonaut/layouter/print.js

// Renders a Doc (see builders.js) into a string, deciding per `group`
// whether it fits flat within the configured width, or must break onto
// multiple lines. Classic Wadler-style algorithm: a command stack of
// (indent, mode, doc) triples, with a `fits()` lookahead used once per
// group to decide its mode - plus two extensions on top of the bare
// algorithm:
//
//   1. propagateBreaks() - a pure pre-pass that marks any `group`
//      containing a `hardline` (directly, or through nested concat/indent/
//      groups) as `break: true`. Without this, `fits()` would report such
//      a group as "fits flat" the moment it reaches the hardline (which is
//      correct in isolation), but the group's own line/softline siblings
//      would then incorrectly render as spaces instead of real breaks.
//
//   2. lineSuffix handling - content wrapped in `lineSuffix()` is buffered
//      and flushed right before the next real line break, regardless of
//      where in the tree it was inserted. Used for trailing comments.

import {
  DOC_TEXT, DOC_CONCAT, DOC_LINE, DOC_GROUP, DOC_INDENT, DOC_IF_BREAK, DOC_LINE_SUFFIX,
} from './nodes.js';

const MODE_FLAT  = 'flat';
const MODE_BREAK = 'break';

// :::::: propagateBreaks (pure - returns a new tree, does not mutate input)

function propagateBreaks (doc) {
  switch (doc.type) {
    case DOC_TEXT:
      return { doc, willBreak: false };

    case DOC_LINE:
      return { doc, willBreak: !!doc.hard };

    case DOC_CONCAT: {
      let willBreak = false;
      const parts = doc.parts.map(part => {
        const result = propagateBreaks(part);
        if (result.willBreak) willBreak = true;
        return result.doc;
      });
      return { doc: { ...doc, parts }, willBreak };
    }

    case DOC_INDENT: {
      const result = propagateBreaks(doc.contents);
      return { doc: { ...doc, contents: result.doc }, willBreak: result.willBreak };
    }

    case DOC_GROUP: {
      const result    = propagateBreaks(doc.contents);
      const willBreak = doc.break || result.willBreak;
      return { doc: { ...doc, contents: result.doc, break: willBreak }, willBreak };
    }

    case DOC_IF_BREAK: {
      const breakResult = propagateBreaks(doc.breakContents);
      const flatResult  = propagateBreaks(doc.flatContents);
      return {
        doc: { ...doc, breakContents: breakResult.doc, flatContents: flatResult.doc },
        willBreak: false, // a hardline inside either branch doesn't force the *outer* group to break
      };
    }

    case DOC_LINE_SUFFIX: {
      const result = propagateBreaks(doc.contents);
      return { doc: { ...doc, contents: result.doc }, willBreak: false }; // deferred content, doesn't force outer breaks
    }

    default:
      return { doc, willBreak: false };
  }
}

// :::::: fits() - bounded lookahead used once per group to decide its mode

function fits (next, restCommands, width) {
  let remaining = width;
  const cmds    = [next];
  let restIndex = restCommands.length;

  while (remaining >= 0) {
    if (cmds.length === 0) {
      if (restIndex === 0) return true;
      cmds.push(restCommands[--restIndex]);
      continue;
    }

    const { mode, doc } = cmds.pop();

    switch (doc.type) {
      case DOC_TEXT:
        remaining -= doc.value.length;
        break;

      case DOC_CONCAT:
        for (let i = doc.parts.length - 1; i >= 0; i--) {
          cmds.push({ mode, doc: doc.parts[i] });
        }
        break;

      case DOC_INDENT:
        cmds.push({ mode, doc: doc.contents });
        break;

      case DOC_GROUP:
        cmds.push({ mode: doc.break ? MODE_BREAK : mode, doc: doc.contents });
        break;

      case DOC_LINE:
        if (doc.hard || mode === MODE_BREAK) return true;
        if (!doc.soft) remaining -= 1;
        break;

      case DOC_IF_BREAK:
        cmds.push({ mode, doc: mode === MODE_BREAK ? doc.breakContents : doc.flatContents });
        break;

      case DOC_LINE_SUFFIX:
        // deferred content doesn't count against the current line's width
        break;
    }
  }

  return false;
}

// :::::: print

export function print (doc, { width = 80, indentSize = 2 } = {}) {
  const { doc: propagatedDoc } = propagateBreaks(doc);

  let pos = 0;
  let out = '';
  let lineSuffixes = [];

  const cmds = [{ indent: 0, mode: MODE_BREAK, doc: propagatedDoc }];

  while (cmds.length > 0) {
    const { indent, mode, doc } = cmds.pop();

    switch (doc.type) {
      case DOC_TEXT:
        out += doc.value;
        pos += doc.value.length;
        break;

      case DOC_CONCAT:
        for (let i = doc.parts.length - 1; i >= 0; i--) {
          cmds.push({ indent, mode, doc: doc.parts[i] });
        }
        break;

      case DOC_INDENT:
        cmds.push({ indent: indent + (doc.amount ?? indentSize), mode, doc: doc.contents });
        break;

      case DOC_GROUP: {
        const flatCmd = { indent, mode: MODE_FLAT, doc: doc.contents };
        if (!doc.break && fits(flatCmd, cmds, width - pos)) {
          cmds.push(flatCmd);
        } else {
          cmds.push({ indent, mode: MODE_BREAK, doc: doc.contents });
        }
        break;
      }

      case DOC_LINE_SUFFIX:
        lineSuffixes.push({ indent, mode, doc: doc.contents });
        break;

      case DOC_LINE: {
        const isRealBreak = doc.hard || mode === MODE_BREAK;

        if (!isRealBreak) {
          if (!doc.soft) { out += ' '; pos += 1; }
          break;
        }

        // flush any pending line-suffix content before the actual break,
        // so trailing comments end up at the end of the current line
        if (lineSuffixes.length > 0) {
          cmds.push({ indent, mode, doc }); // re-process this same line break afterwards
          for (let i = lineSuffixes.length - 1; i >= 0; i--) cmds.push(lineSuffixes[i]);
          lineSuffixes = [];
          break;
        }

        out = out.replace(/[ \t]+$/, ''); // no trailing whitespace before a newline
        out += '\n' + ' '.repeat(indent);
        pos = indent;
        break;
      }

      case DOC_IF_BREAK:
        cmds.push({ indent, mode, doc: mode === MODE_BREAK ? doc.breakContents : doc.flatContents });
        break;
    }
  }

  // flush any line-suffix content left over at the very end of the document
  if (lineSuffixes.length > 0) {
    cmds.push(...lineSuffixes);
    while (cmds.length > 0) {
      const { doc } = cmds.pop();
      if (doc.type === DOC_TEXT) out += doc.value;
      else if (doc.type === DOC_CONCAT) doc.parts.forEach(part => cmds.push({ doc: part }));
    }
  }

  return out;
}
