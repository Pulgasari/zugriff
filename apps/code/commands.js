// apps/code/commands.js
//
// the command registry — every action the command palette, the dock and the
// toolbar can fire, keyed by id. ported from the old js/commands.js; the editor
// option commands are rewired onto editor.js's get/set/toggleConfig helpers, and
// the file commands (which were stubs) are wired to state's file operations.
//
// this module imports `state` too, but only reads it inside the exec closures,
// so the state <-> commands import cycle resolves fine (nothing is touched at
// module-evaluation time).

import state  from './state.js';
import editor from './editor.js';

// helpers
const monacoAction  = id => state.monaco?.getAction(id)?.run();
const monacoTrigger = id => state.monaco?.trigger('keyboard', id, null);

const commands = new Map([
  // ── UI ──────────────────────────────────────────────────────────────────
  ['browser:toggle'     , { name: 'Toggle Browser'     , exec: () => state.toggleSignal(state.config.showBrowser)   }],
  ['keyboard:toggle'    , { name: 'Toggle Keyboard'    , exec: () => state.toggleSignal(state.config.showKeyboard)  }],
  ['toolbar:toggle'     , { name: 'Toggle Toolbar'     , exec: () => state.toggleSignal(state.config.showToolbar)   }],
  ['statusbar:toggle'   , { name: 'Toggle Statusbar'   , exec: () => state.toggleSignal(state.config.showStatusbar) }],
  ['filebrowser:toggle' , { name: 'Toggle File Browser', exec: () => state.toggleModal('filebrowser') }],
  ['commands:toggle'    , { name: 'Toggle Commands'    , exec: () => state.toggleModal('commands')    }],
  ['plugins:toggle'     , { name: 'Toggle Plugins'     , exec: () => state.toggleModal('plugins')     }],
  ['settings:toggle'    , { name: 'Toggle Settings'    , exec: () => state.toggleModal('settings')    }],
  ['workspaces:toggle'  , { name: 'Toggle Workspaces'  , exec: () => state.toggleModal('workspaces')  }],

  // ── File ────────────────────────────────────────────────────────────────
  ['file:close'   , { name: 'Close File' , exec: () => { const f = state.activeFile.value; if (f) state.closeFile(f); } }],
  ['file:save'    , { name: 'Save File'  , exec: () => state.saveActiveFile() }],
  ['file:saveAll' , { name: 'Save All'   , exec: async () => {
    for (const f of state.openFiles.value) {
      if (f.isDirty) { state.activeFile.value = f; await state.saveActiveFile(); }
    }
  } }],

  // ── Editor – History ──────────────────────────────────────────────────────
  ['editor:redo'   , { name: 'Redo' , exec: () => state.monaco?.getModel()?.redo() }],
  ['editor:undo'   , { name: 'Undo' , exec: () => state.monaco?.getModel()?.undo() }],

  // ── Editor – Clipboard ────────────────────────────────────────────────────
  ['editor:copy'   , { name: 'Copy'  , exec: () => monacoAction('editor.action.clipboardCopyAction')  }],
  ['editor:cut'    , { name: 'Cut'   , exec: () => monacoAction('editor.action.clipboardCutAction')   }],
  ['editor:paste'  , { name: 'Paste' , exec: () => monacoAction('editor.action.clipboardPasteAction') }],

  // ── Editor – Selection ────────────────────────────────────────────────────
  ['editor:selectAll'            , { name: 'Select All'        , exec: () => monacoTrigger('editor.action.selectAll')                     }],
  ['editor:selectLine'           , { name: 'Select Line'       , exec: () => monacoAction('editor.action.smartSelect.expand')             }],
  ['editor:expandSelection'      , { name: 'Expand Selection'  , exec: () => monacoAction('editor.action.smartSelect.expand')             }],
  ['editor:shrinkSelection'      , { name: 'Shrink Selection'  , exec: () => monacoAction('editor.action.smartSelect.shrink')             }],
  ['editor:addCursorAbove'       , { name: 'Add Cursor Above'  , exec: () => monacoAction('editor.action.insertCursorAbove')              }],
  ['editor:addCursorBelow'       , { name: 'Add Cursor Below'  , exec: () => monacoAction('editor.action.insertCursorBelow')              }],
  ['editor:selectNextOccurrence' , { name: 'Select Next Match' , exec: () => monacoAction('editor.action.addSelectionToNextFindMatch')    }],

  // ── Editor – Lines ────────────────────────────────────────────────────────
  ['editor:deleteLines'    , { name: 'Delete Line'          , exec: () => monacoAction('editor.action.deleteLines')         }],
  ['editor:duplicateLine'  , { name: 'Duplicate Line Down'  , exec: () => monacoAction('editor.action.copyLinesDownAction') }],
  ['editor:moveLineUp'     , { name: 'Move Line Up'         , exec: () => monacoAction('editor.action.moveLinesUpAction')   }],
  ['editor:moveLineDown'   , { name: 'Move Line Down'       , exec: () => monacoAction('editor.action.moveLinesDownAction') }],
  ['editor:indentLines'    , { name: 'Indent'               , exec: () => monacoAction('editor.action.indentLines')         }],
  ['editor:outdentLines'   , { name: 'Outdent'              , exec: () => monacoAction('editor.action.outdentLines')        }],
  ['editor:sortLinesAsc'   , { name: 'Sort Lines Asc'       , exec: () => monacoAction('editor.action.sortLinesAscending')  }],
  ['editor:sortLinesDesc'  , { name: 'Sort Lines Desc'      , exec: () => monacoAction('editor.action.sortLinesDescending') }],
  ['editor:joinLines'      , { name: 'Join Lines'           , exec: () => monacoAction('editor.action.joinLines')           }],
  ['editor:commentLine'    , { name: 'Toggle Line Comment'  , exec: () => monacoAction('editor.action.commentLine')         }],
  ['editor:commentBlock'   , { name: 'Toggle Block Comment' , exec: () => monacoAction('editor.action.blockComment')        }],

  // ── Editor – Folding ──────────────────────────────────────────────────────
  ['editor:fold'          , { name: 'Fold'           , exec: () => monacoAction('editor.fold')          }],
  ['editor:unfold'        , { name: 'Unfold'         , exec: () => monacoAction('editor.unfold')        }],
  ['editor:foldAll'       , { name: 'Fold All'       , exec: () => monacoAction('editor.foldAll')       }],
  ['editor:unfoldAll'     , { name: 'Unfold All'     , exec: () => monacoAction('editor.unfoldAll')     }],
  ['editor:foldRecursive' , { name: 'Fold Recursive' , exec: () => monacoAction('editor.foldRecursive') }],

  // ── Editor – Search ───────────────────────────────────────────────────────
  ['editor:find'        , { name: 'Find'           , exec: () => monacoAction('actions.find')                            }],
  ['editor:findReplace' , { name: 'Find & Replace' , exec: () => monacoAction('editor.action.startFindReplaceAction')    }],
  ['editor:findNext'    , { name: 'Find Next'      , exec: () => monacoAction('editor.action.nextMatchFindAction')       }],
  ['editor:findPrev'    , { name: 'Find Previous'  , exec: () => monacoAction('editor.action.previousMatchFindAction')   }],

  // ── Editor – Code ─────────────────────────────────────────────────────────
  ['editor:format'          , { name: 'Format Document'  , exec: () => monacoAction('editor.action.formatDocument')  }],
  ['editor:formatSelection' , { name: 'Format Selection' , exec: () => monacoAction('editor.action.formatSelection') }],
  ['editor:goToDefinition'  , { name: 'Go to Definition' , exec: () => monacoAction('editor.action.revealDefinition') }],
  ['editor:rename'          , { name: 'Rename Symbol'    , exec: () => monacoAction('editor.action.rename')          }],
  ['editor:quickFix'        , { name: 'Quick Fix'        , exec: () => monacoAction('editor.action.quickFix')        }],

  // ── Editor – View / Options ───────────────────────────────────────────────
  ['editor:wordWrap:toggle'    , { name: 'Toggle Word Wrap'      , exec: () => editor.toggleConfig('wordWrap')        }],
  ['editor:lineNumbers:toggle' , { name: 'Toggle Line Numbers'   , exec: () => editor.toggleConfig('lineNumbers')     }],
  ['editor:minimap:toggle'     , { name: 'Toggle Minimap'        , exec: () => editor.toggleConfig('minimap.enabled') }],
  ['editor:fontSize:increase'  , { name: 'Font Size +'           , exec: () => editor.set('fontSize', editor.get('fontSize') + 1)              }],
  ['editor:fontSize:decrease'  , { name: 'Font Size –'           , exec: () => editor.set('fontSize', Math.max(6, editor.get('fontSize') - 1)) }],
]);

export default commands;
export { commands };
