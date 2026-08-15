// shared/js/components/index.js
//
// the light barrel — replaces the old `tools` bare specifier that pointed at
// global.js on the php server.
//
// the code panes are deliberately NOT re-exported here: they pull in
// highlight.js, and importing this file must not cost every app a syntax
// highlighter it never uses. they live in ./code.js, the audio canvases in
// ./media.js.

export { default as Button      } from './Button.js';
export { default as CopyIcon    } from './CopyIcon.js';
export { default as Dropzone    } from './Dropzone.js';
export { default as GhostButton } from './GhostButton.js';
export { default as Icon        } from './Icon.js';
export { default as Picker      } from './Picker.js';
export { default as Shell       } from './Shell.js';
export { default as Slider      } from './Slider.js';
export { default as Toggle      } from './Toggle.js';

export { Prompt, openPrompt } from './Prompt.js';
export { copy }               from './CopyIcon.js';
export { icons, resolveIcon } from './Icon.js';
export { toEntry }            from './Dropzone.js';
