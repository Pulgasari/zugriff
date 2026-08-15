// index.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import aufbau, { html, preact } from '@aufbau/kits/preact-htm';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

// ::: local: app
import * as config from './config.js';

// ::: local: shared
import { vfs } from './../shared/js/vfs.js';

// :::::: CONFIG ::::::::::::::::::::::::::::::::::::::::::::

aufbau.init();
const { useEffect, useRef, signal } = preact;

// Signal tracking loaded WASM tools
const loadedCommands = signal(new Set(['help', 'init', 'clear', 'ls', 'upload', 'download', 'rm']));

function TerminalView() {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal (config.terminal);

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Spawn background Web Worker
    const worker = new Worker('worker.js', { type: 'module' });

    // Handle incoming messages from the execution worker
    worker.onmessage = (e) => {
      const { type, text } = e.data;
      /*
      switch (type) {
        case 'STDOUT' : term.writeln(`\x1b[36m${text}\x1b[0m`); break;
        case 'STDERR' : term.writeln(`\x1b[31m${text}\x1b[0m`); break;
        case 'EXIT'   : writePrompt();
      }
      */
      if (type === 'STDOUT') {
        term.writeln(`\x1b[36m${text}\x1b[0m`);
      } else if (type === 'STDERR') {
        term.writeln(`\x1b[31m${text}\x1b[0m`);
      } else if (type === 'EXIT') {
        writePrompt();
      }
    };

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    let currentLine = '';
    let isExecuting = false;
    const prompt = 'zugriff> ';

    const writePrompt = () => {
      isExecuting = false;
      term.write(`\r\n\x1b[32m${prompt}\x1b[0m`);
    };

    term.writeln('\x1b[1;34m=== zugriff v0.2.0 ===\x1b[0m');
    term.writeln('Client-side WASM micro-terminal. Type "help" to list available commands.');
    term.write(`\x1b[32m${prompt}\x1b[0m`);

    // Intercept keyboard commands
    term.onData(async (data) => {
      if (isExecuting) return;

      const charCode = data.charCodeAt(0);

      if (charCode === 13) { // Enter
        term.write('\r\n');
        const input = currentLine.trim();
        currentLine = '';
        
        if (input) {
          isExecuting = true;
          await handleCommand(input, term, worker, writePrompt);
        } else {
          writePrompt();
        }
      } else if (charCode === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (charCode >= 32) { // Printable characters
        currentLine += data;
        term.write(data);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      worker.terminate();
      term.dispose();
    };
  }, []);

  return html`
    <div class="terminal-container" ref=${terminalRef}></div>
  `;
}

// Application Layout Shell
function App() {
  const activeCount = loadedCommands.value.size;

  return html`
    <header id="app-head">
      <h1>zugriff</h1>
      <span style=${{ fontSize: '0.8rem', color: '#8b949e' }}>v0.2.0</span>
    </header>
    
    <main id="app-main">
      <${TerminalView} />
    </main>
    
    <footer id="app-foot">
      <span>Engine: OPFS + WebWorker</span>
      <span>Loaded Tools: ${activeCount}</span>
    </footer>
  `;
}

// Dispatch commands to built-in handlers or Web Worker
async function handleCommand(rawInput, term, worker, finishCallback) {
  const [cmd, ...args] = rawInput.split(/\s+/);

  switch (cmd) {
    case 'help':
      term.writeln('Available commands:');
      term.writeln('  ls           - List files in virtual filesystem (OPFS)');
      term.writeln('  upload       - Open file dialog to upload file into OPFS');
      term.writeln('  download <f> - Download file from OPFS to host system');
      term.writeln('  rm <f>       - Delete file from OPFS');
      term.writeln('  init <tool>  - Register WASM executable tool');
      term.writeln('  clear        - Clear terminal screen');
      finishCallback();
      break;

    case 'clear':
      term.clear();
      finishCallback();
      break;

    case 'ls':
      try {
        const files = await vfs.listFiles();
        if (files.length === 0) {
          term.writeln('VFS is empty.');
        } else {
          files.forEach(f => term.writeln(`${f.name.padEnd(25)}${f.size} bytes`));
        }
      } catch (err) {
        term.writeln(`\x1b[31mError accessing VFS: ${err.message}\x1b[0m`);
      }
      finishCallback();
      break;

    case 'upload':
      triggerFileUpload(term, finishCallback);
      break;

    case 'download':
      if (!args[0]) {
        term.writeln('\x1b[31mError: Filename required. Usage: download <filename>\x1b[0m');
        finishCallback();
        break;
      }
      await triggerFileDownload(args[0], term);
      finishCallback();
      break;

    case 'rm':
      if (!args[0]) {
        term.writeln('\x1b[31mError: Filename required. Usage: rm <filename>\x1b[0m');
        finishCallback();
        break;
      }
      try {
        await vfs.removeFile(args[0]);
        term.writeln(`Removed file: ${args[0]}`);
      } catch (err) {
        term.writeln(`\x1b[31mError removing file: ${err.message}\x1b[0m`);
      }
      finishCallback();
      break;

    case 'init':
      if (!args[0]) {
        term.writeln('\x1b[31mError: Tool name required. Usage: init <tool>\x1b[0m');
        finishCallback();
        break;
      }
      const tool = args[0];
      loadedCommands.value = new Set([...loadedCommands.value, tool]);
      term.writeln(`\x1b[32mRegistered WASM executable: ${tool}\x1b[0m`);
      finishCallback();
      break;

    default:
      if (loadedCommands.value.has(cmd)) {
        // Delegate CPU work to Web Worker
        worker.postMessage({ type: 'RUN_COMMAND', payload: { cmd, args } });
      } else {
        term.writeln(`\x1b[31mCommand not found: ${cmd}. Type "help" for instructions.\x1b[0m`);
        finishCallback();
      }
      break;
  }
}

// Helper: Programmatic file upload to OPFS
function triggerFileUpload(term, callback) {
  const input = document.createElement('input');
  input.type = 'file';

  // 1. User selects a file
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      term.writeln(`Uploading ${file.name} to VFS...`);
      const buffer = await file.arrayBuffer();
      await vfs.writeFile(file.name, buffer);
      term.writeln(`\x1b[32mSuccessfully saved ${file.name} to OPFS.\x1b[0m`);
    } else {
      term.writeln('Upload canceled.');
    }
    callback();
  };

  // 2. User cancels/closes the file dialog window
  input.oncancel = () => {
    term.writeln('Upload canceled.');
    callback();
  };

  input.click();
}


// Helper: Download file from OPFS
async function triggerFileDownload(filename, term) {
  try {
    const buffer = await vfs.readFile(filename);
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    term.writeln(`Triggered download for: ${filename}`);
  } catch (err) {
    term.writeln(`\x1b[31mDownload failed: ${err.message}\x1b[0m`);
  }
}

// Mount Root
preact.render(html`<${App} />`, document.getElementById('app'));
