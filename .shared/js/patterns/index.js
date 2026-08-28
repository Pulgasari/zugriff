// shared/js/patterns/index.js
//
// app blueprints — a whole app built from a handful of options.
//
// CodeConverterApp and CodeTransformerApp were two copies of the same thing
// (the transformer being the converter without a format switcher); both names
// now point at CodeWorkbenchApp.

export { default as CodeWorkbenchApp   } from './CodeWorkbenchApp.js';
export { default as CodeConverterApp   } from './CodeWorkbenchApp.js';
export { default as CodeTransformerApp } from './CodeWorkbenchApp.js';
export { default as DataInspectorApp   } from './DataInspectorApp.js';
export { typeOf, typeIcon, typeColor   } from './DataInspectorApp.js';
