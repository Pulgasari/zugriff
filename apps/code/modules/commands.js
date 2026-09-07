// apps/code/modules/commands.js
// the command registry — every action the palette, the dock and the toolbar can fire,
// keyed by id. exec closures reach the rest of the app through the zugriff.app global
// (app.editor, app.files, app.state, …), so there is no import cycle: nothing here
// touches the app at module-evaluation time, only when a command runs.

import { openPrompt } from '/.shared/js/components/index.js';

const app = zugriff.app;

// a promise-returning commit-message prompt (default = the auto message)
const askCommitMessage = (path) => new Promise(resolve => openPrompt({
  title: 'Commit message',
  placeholder: `Update ${path}`,
  value: `Update ${path}`,
  onConfirm: msg => resolve(msg || `Update ${path}`),
  onCancel: () => resolve(null),
}));

// monaco helpers — the live instance lives on app.editor.instance
const monacoAction  = id => app.editor.instance?.getAction(id)?.run();
const monacoTrigger = id => app.editor.instance?.trigger('keyboard', id, null);

// flip a persisted chrome toggle on app.state.config
const toggleConfig = key => { app.state.config[key] = !app.state.config[key]; };

// save one file, surfacing a failed GitHub commit in the GitHub modal rather than
// throwing into the void (a local save that fails just returns false)
const save = async (file) => {
  if (!file || file.readOnly) return;
  try {
    if (file.source === 'github' && app.state.config.commitPrompt) {
      const message = await askCommitMessage(file.gh.path);
      if (message == null) return;            // cancelled
      await app.files.save({ message });
    } else {
      await app.files.save();
    }
  } catch (e) {
    if (file.source === 'github') { app.workspaces.github.error.value = e.message; app.openModal('github'); }
    else console.error('[code] save failed:', e);
  }
};

const commands = new Map([
  // ── UI ──────────────────────────────────────────────────────────────────
  ['browser:toggle'     , { name: 'Toggle Browser'     , exec: () => toggleConfig('showBrowser')   }],
  ['keyboard:toggle'    , { name: 'Toggle Keyboard'    , exec: () => toggleConfig('showKeyboard')  }],
  ['toolbar:toggle'     , { name: 'Toggle Toolbar'     , exec: () => toggleConfig('showToolbar')   }],
  ['statusbar:toggle'   , { name: 'Toggle Statusbar'   , exec: () => toggleConfig('showStatusbar') }],
  ['filebrowser:toggle' , { name: 'Toggle File Browser', exec: () => app.toggleModal('filebrowser') }],
  ['github:toggle'      , { name: 'Toggle GitHub'      , exec: () => app.toggleModal('github')      }],
  ['commands:toggle'    , { name: 'Toggle Commands'    , exec: () => app.toggleModal('commands')    }],
  ['plugins:toggle'     , { name: 'Toggle Plugins'     , exec: () => app.toggleModal('plugins')     }],
  ['settings:toggle'    , { name: 'Toggle Settings'    , exec: () => app.toggleModal('settings')    }],
  ['workspaces:toggle'  , { name: 'Toggle Workspaces'  , exec: () => app.toggleModal('workspaces')  }],

  // ── File ────────────────────────────────────────────────────────────────
  ['file:close'   , { name: 'Close File' , exec: () => { const f = app.files.active.value; if (f) app.files.close(f); } }],
  ['file:save'    , { name: 'Save File'  , exec: () => save(app.files.active.value) }],
  ['file:saveAll' , { name: 'Save All'   , exec: async () => {
    for (const f of [...app.files.open.value]) {
      if (f.isDirty) { app.files.active.value = f; await save(f); }
    }
  } }],

  // ── Editor – History ──────────────────────────────────────────────────────
  ['editor:redo'   , { name: 'Redo' , exec: () => app.editor.instance?.getModel()?.redo() }],
  ['editor:undo'   , { name: 'Undo' , exec: () => app.editor.instance?.getModel()?.undo() }],

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
  ['editor:wordWrap:toggle'    , { name: 'Toggle Word Wrap'      , exec: () => app.editor.toggleConfig('wordWrap')        }],
  ['editor:lineNumbers:toggle' , { name: 'Toggle Line Numbers'   , exec: () => app.editor.toggleConfig('lineNumbers')     }],
  ['editor:minimap:toggle'     , { name: 'Toggle Minimap'        , exec: () => app.editor.toggleConfig('minimap.enabled') }],
  ['editor:fontSize:increase'  , { name: 'Font Size +'           , exec: () => app.editor.set('fontSize', app.editor.get('fontSize') + 1)              }],
  ['editor:fontSize:decrease'  , { name: 'Font Size –'           , exec: () => app.editor.set('fontSize', Math.max(6, app.editor.get('fontSize') - 1)) }],
]);

export default commands;
export { commands };
