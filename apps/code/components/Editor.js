// apps/code/components/Editor.js
// the Monaco editor. Monaco is loaded through ./../monaco.js (its AMD loader on
// a versioned CDN) rather than imported here, because the esm.sh ?worker builds
// are broken and the service worker chokes on esm.sh streaming responses.

import { html, useEffect, useRef } from '@aufbau/kits/preact-htm';
import state       from './../state.js';
import { loadMonaco } from './../monaco.js';
import Welcome     from './Welcome.js';

export default function Editor () {
  const containerRef = useRef(null);
  const monacoRef    = useRef(null);   // the Monaco namespace
  const editorRef    = useRef(null);   // the editor instance
  const programmatic = useRef(false);  // true while we set the value ourselves
  const activeFile   = state.activeFile.value;
  const cfg          = state.editor.config.value; // subscribe to option changes

  // create Monaco once (async: the loader resolves when the editor is ready)
  useEffect(() => {
    let disposed = false;
    loadMonaco().then(monaco => {
      if (disposed || !containerRef.current) return;
      monacoRef.current = monaco;
      const { theme, ...options } = state.editor.config.value;
      const instance = monaco.editor.create(containerRef.current, {
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
    }).catch(err => console.error('[code] Monaco failed to load:', err));

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
      state.monaco = null;
    };
  }, []);

  // swap the model contents / language when the active file changes
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!editorRef.current || !monaco || !activeFile) return;
    if (editorRef.current.getValue() !== activeFile.content) {
      programmatic.current = true;
      editorRef.current.setValue(activeFile.content);
      programmatic.current = false;
    }
    monaco.editor.setModelLanguage(editorRef.current.getModel(), activeFile.language);
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
