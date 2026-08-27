// apps/code/components/Editor.js
// the Monaco editor. Monaco is a big, self-contained bundle that brings its own
// preact-free world, so it is imported straight from the CDN by full URL rather
// than through the import map (which pins the app's single preact copy). the
// language workers are wired the same way the source did.

import { html, useEffect, useRef } from '@aufbau/kits/preact-htm';
import * as Monaco  from 'https://esm.sh/monaco-editor@0.50.0?bundle';
import EditorWorker from 'https://esm.sh/monaco-editor@0.50.0/esm/vs/editor/editor.worker?worker';
import   JsonWorker from 'https://esm.sh/monaco-editor@0.50.0/esm/vs/language/json/json.worker?worker';
import    CssWorker from 'https://esm.sh/monaco-editor@0.50.0/esm/vs/language/css/css.worker?worker';
import   HtmlWorker from 'https://esm.sh/monaco-editor@0.50.0/esm/vs/language/html/html.worker?worker';
import     TsWorker from 'https://esm.sh/monaco-editor@0.50.0/esm/vs/language/typescript/ts.worker?worker';

import state   from './../state.js';
import Welcome from './Welcome.js';

// editor.js reads the Monaco namespace off self.monaco to (un)load themes
self.monaco = Monaco;
self.MonacoEnvironment = {
  getWorker (_, label) {
    return ({
      css: new CssWorker(), less: new CssWorker(), scss: new CssWorker(),
      html: new HtmlWorker(),
      json: new JsonWorker(),
      javascript: new TsWorker(), typescript: new TsWorker(),
    })[label] || EditorWorker();
  },
};

export default function Editor () {
  const containerRef = useRef(null);
  const editorRef    = useRef(null);
  const programmatic = useRef(false); // true while we set the value ourselves
  const activeFile   = state.activeFile.value;
  const cfg          = state.editor.config.value; // subscribe to option changes

  // create Monaco once
  useEffect(() => {
    if (!containerRef.current) return;
    const { theme, ...options } = state.editor.config.value;
    const instance = Monaco.editor.create(containerRef.current, {
      ...options,
      value    : state.activeFile.value?.content  ?? '',
      language : state.activeFile.value?.language ?? 'plaintext',
    });
    editorRef.current = instance;
    state.monaco      = instance;

    state.editor.updateTheme(theme);

    // push edits back into the open-file record and flag it dirty — but ignore
    // the change events our own setValue() (on tab switch) triggers
    instance.onDidChangeModelContent(() => {
      if (programmatic.current) return;
      const file = state.activeFile.value;
      if (!file) return;
      state.patchFile(file, { content: instance.getValue(), isDirty: true });
    });

    return () => { instance.dispose(); state.monaco = null; };
  }, []);

  // swap the model contents / language when the active file changes
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;
    if (editorRef.current.getValue() !== activeFile.content) {
      programmatic.current = true;
      editorRef.current.setValue(activeFile.content);
      programmatic.current = false;
    }
    Monaco.editor.setModelLanguage(editorRef.current.getModel(), activeFile.language);
  }, [activeFile]);

  // apply option changes (theme is driven separately through updateTheme)
  useEffect(() => {
    if (!editorRef.current) return;
    const { theme, ...options } = state.editor.config.value;
    editorRef.current.updateOptions(options);
  }, [cfg]);

  return html`
    <div id="editor">
      ${!activeFile && html`<${Welcome} />`}
      <div id="monaco-container" ref=${containerRef} style=${`display: ${activeFile ? 'block' : 'none'}`}></div>
    </div>
  `;
}
