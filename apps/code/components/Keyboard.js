// apps/code/components/Keyboard.js
// an on-screen code keyboard tuned for the phone. it dispatches real keyboard
// events at the focused element (so Monaco reacts) and, where the browser
// supports it, suppresses the native Android keyboard via the VirtualKeyboard
// API. layout is German by default (the app's origin), symbols on top.

import { html, useState, useEffect } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import KeyboardButton from './KeyboardButton.js';

const layouts = {
  de: {
    regular : ['qwertzuiopü', 'asdfghjklöä', '--yxcvbnm--'],
    shift   : ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '--YXCVBNM--'],
    symbols : [`([{<?.,'$#=+*12345`, `)]}>!:;"&|_-/67890`],
  },
};

// ── native (Android) keyboard suppression ────────────────────────────────────

const KB_SELECTOR = 'input, textarea, [contenteditable]';
const setManual   = el => el.setAttribute('virtualkeyboardpolicy', 'manual');
const setAuto     = el => el.removeAttribute('virtualkeyboardpolicy');
const onFocusIn   = () => navigator.virtualKeyboard?.hide();
let   observer    = null;

export const disableAndroidKeyboard = () => {
  if (!navigator.virtualKeyboard) return;
  navigator.virtualKeyboard.overlaysContent = true;
  document.querySelectorAll(KB_SELECTOR).forEach(setManual);
  observer = new MutationObserver(mutations => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(KB_SELECTOR)) setManual(node);
        node.querySelectorAll?.(KB_SELECTOR).forEach(setManual);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('focusin', onFocusIn, true);
};

export const enableAndroidKeyboard = () => {
  if (!navigator.virtualKeyboard) return;
  navigator.virtualKeyboard.overlaysContent = false;
  document.querySelectorAll(KB_SELECTOR).forEach(setAuto);
  observer?.disconnect();
  observer = null;
  document.removeEventListener('focusin', onFocusIn, true);
};

// ── component ────────────────────────────────────────────────────────────────

export default function Keyboard () {
  const [layoutCode]                          = useState('de');
  const [isShiftPressed, setIsShiftPressed]   = useState(false);
  const [isCapsLock,     setIsCapsLock]       = useState(false);
  const [isAltPressed]                        = useState(false);
  const [isCtrlPressed]                       = useState(false);

  useEffect(() => () => {
    if (!state.config.disableAndroidKeyboard.value) enableAndroidKeyboard();
  }, []);

  const specialKeys = ['alt', 'backspace', 'capslock', 'ctrl', 'enter', 'shift', 'space', 'tab', 'tab-rtl', 'left', 'right', 'up', 'down'];
  const isSpecial   = key => specialKeys.includes(key);

  const dispatchKey = (key, options = {}) => {
    const target = document.activeElement;
    if (!target) return;

    const eventConfig = {
      key, shiftKey: isShiftPressed || isCapsLock, ctrlKey: isCtrlPressed, altKey: isAltPressed,
      bubbles: true, cancelable: true, ...options,
    };

    target.dispatchEvent(new KeyboardEvent('keydown', eventConfig));

    if (key.length === 1 && !isCtrlPressed && !isAltPressed && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      const start = target.selectionStart;
      const end   = target.selectionEnd;
      target.value = target.value.slice(0, start) + key + target.value.slice(end);
      target.selectionStart = target.selectionEnd = start + key.length;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }

    target.dispatchEvent(new KeyboardEvent('keyup', eventConfig));

    if (isShiftPressed && !isCapsLock) setIsShiftPressed(false);
  };

  const handleSpecialKey = action => {
    switch (action) {
      case 'shift'     : setIsShiftPressed(!isShiftPressed); break;
      case 'capslock'  : setIsCapsLock(!isCapsLock); setIsShiftPressed(false); break;
      case 'backspace' : dispatchKey('Backspace',  { keyCode:  8 }); break;
      case 'enter'     : dispatchKey('Enter',      { keyCode: 13 }); break;
      case 'tab'       : dispatchKey('Tab',        { keyCode:  9 }); break;
      case 'space'     : dispatchKey(' ',          { keyCode: 32 }); break;
      case 'left'      : dispatchKey('ArrowLeft',  { keyCode: 37 }); break;
      case 'right'     : dispatchKey('ArrowRight', { keyCode: 39 }); break;
      case 'up'        : dispatchKey('ArrowUp',    { keyCode: 38 }); break;
      case 'down'      : dispatchKey('ArrowDown',  { keyCode: 40 }); break;
    }
  };

  const handleAction = key => isSpecial(key) ? handleSpecialKey(key) : dispatchKey(key);

  const isShifted    = isShiftPressed || isCapsLock;
  const layout       = layouts[layoutCode];
  const currentAlpha = isShifted ? layout.shift : layout.regular;
  const normalizeRow = row => typeof row === 'string' ? row.split('') : row;

  const renderRow = (row, rowIndex, type = 'alpha') => {
    const chars = normalizeRow(row);
    return html`
      <div class="row">
        ${type === 'alpha' && rowIndex === 0 && html`<${KeyboardButton} keyValue="tab"      icon="tab"      className="w-2" onAction=${handleAction} />`}
        ${type === 'alpha' && rowIndex === 1 && html`<${KeyboardButton} keyValue="capslock" icon="capslock" className="w-2" onAction=${handleAction} active=${isCapsLock} />`}
        ${type === 'alpha' && rowIndex === 2 && html`<${KeyboardButton} keyValue="shift"    icon="shift"    className="w-2" onAction=${handleAction} active=${isShiftPressed} />`}

        ${chars.map((char, index) => (char === '–' || char === '-' || char === ' ')
          ? html`<div key=${index} class="keyboard-spacer"></div>`
          : html`<${KeyboardButton} key=${index} keyValue=${char} className=${type === 'symbol' ? 'symbol' : ''} onAction=${handleAction} />`)}

        ${type === 'alpha' && rowIndex === 0 && html`<${KeyboardButton} keyValue="tab-rtl"   icon="tab-rtl"   className="w-2" onAction=${handleAction} />`}
        ${type === 'alpha' && rowIndex === 1 && html`<${KeyboardButton} keyValue="backspace" icon="backspace" className="w-2" onAction=${handleAction} />`}
        ${type === 'alpha' && rowIndex === 2 && html`<${KeyboardButton} keyValue="enter"     icon="enter"     className="w-2" onAction=${handleAction} />`}
      </div>`;
  };

  return html`
    <div id="keyboard">
      <div id="keyboard-symbols">
        ${layout.symbols.map((row, i) => renderRow(row, i, 'symbol'))}
      </div>
      <div id="keyboard-keys">
        ${currentAlpha.map((row, i) => renderRow(row, i, 'alpha'))}
        <div class="row">
          <${KeyboardButton} keyValue="ctrl"  className="alt w-2"  disabled=${true} onAction=${handleAction} />
          <${KeyboardButton} keyValue="alt"   className="alt w-2"  disabled=${true} onAction=${handleAction} />
          <${KeyboardButton} keyValue="space" icon="space" className="space w-7" onAction=${handleAction} />
          <${KeyboardButton} keyValue="up"    icon="arrow-up"    onAction=${handleAction} />
          <${KeyboardButton} keyValue="down"  icon="arrow-down"  onAction=${handleAction} />
          <${KeyboardButton} keyValue="left"  icon="arrow-left"  onAction=${handleAction} />
          <${KeyboardButton} keyValue="right" icon="arrow-right" onAction=${handleAction} />
        </div>
      </div>
    </div>
  `;
}
