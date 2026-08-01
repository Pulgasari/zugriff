import { preact, html } from './lib.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const { useEffect, useRef, signal } = preact;

// Signal for active terminal commands
const loadedCommands = signal(new Set(['help', 'init', 'clear']));

function TerminalApp() {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Instantiate xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0f1419',
        foreground: '#e6edf3',
        cursor: '#3fb950'
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace'
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Terminal session state
    let currentLine = '';
    const prompt = 'zugriff> ';

    const writePrompt = () => {
      term.write(`\r\n\x1b[32m${prompt}\x1b[0m`);
    };

    term.writeln('\x1b[1;34m=== zugriff v0.1.0 ===\x1b[0m');
    term.writeln('Client-side WASM micro-terminal. Type "help" to list available commands.');
    term.write(`\x1b[32m${prompt}\x1b[0m`);

    // Key input handler
    term.onData((data) => {
      const charCode = data.charCodeAt(0);

      if (charCode === 13) { // Enter
        term.write('\r\n');
        handleCommand(currentLine.trim(), term);
        currentLine = '';
        writePrompt();
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
      term.dispose();
    };
  }, []);

  return html`
    <div class="terminal-container" ref=${terminalRef}></div>
  `;
}

// Command execution dispatcher
function handleCommand(rawInput, term) {
  if (!rawInput) return;

  const [cmd, ...args] = rawInput.split(/\s+/);

  switch (cmd) {
    case 'help':
      term.writeln('Available commands:');
      term.writeln('  help         - Display this help menu');
      term.writeln('  init <tool>  - Dynamically load WASM executable module');
      term.writeln('  clear        - Clear the terminal screen');
      term.writeln(`Active binaries: ${Array.from(loadedCommands.value).join(', ')}`);
      break;

    case 'clear':
      term.clear();
      break;

    case 'init':
      if (!args[0]) {
        term.writeln('\x1b[31mError: Tool name required. Usage: init <tool>\x1b[0m');
        break;
      }
      const tool = args[0];
      term.writeln(`[zugriff] Initializing WASM environment for "${tool}"...`);
      loadedCommands.value = new Set([...loadedCommands.value, tool]);
      term.writeln(`\x1b[32mSuccessfully registered command: ${tool}\x1b[0m`);
      break;

    default:
      term.writeln(`\x1b[31mCommand not found: ${cmd}. Type "help" for instructions.\x1b[0m`);
      break;
  }
}

// Mount application
preact.render(html`<${TerminalApp} />`, document.getElementById('app'));
