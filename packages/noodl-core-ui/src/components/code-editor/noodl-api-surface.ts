/**
 * What is actually in scope in a Noodl code editor — read off the runtime, not
 * remembered.
 *
 * FH-019 slice 2. This replaces a 25-entry array of string literals that was a
 * snapshot of somebody's memory of the API, maintained by nobody. Every entry
 * below cites the file that puts the name in scope, so the next person can
 * check it rather than trust it.
 *
 * ## The premise this file corrects
 *
 * FH-019 proposed `scopeCompletionSource(globalThis)` for `Noodl.` — "strictly
 * better than the 25 strings and costs nothing, the API is on the object". It
 * is not on any object we can reach. `window.Noodl` is installed by
 * `createNoodlAPI` (`noodl-viewer-react/src/noodl-js-api.ts`) **in the preview
 * frame**; in the editor renderer `globalThis.Noodl` is undefined, so
 * `scopeCompletionSource(globalThis)` would enumerate the *editor's* globals —
 * `React`, `Electron`, `webpackJsonp`. FH-019's own trap list says this and its
 * slice 2 says the opposite; the trap list is right.
 *
 * A declared surface is therefore the only honest option here, and the cost of
 * that is that this file has to be kept in step with the two runtime files it
 * mirrors. Both are cited, and the tests pin the shape.
 *
 * ## Two different `Noodl`s
 *
 * The single biggest thing the old array got wrong. `Noodl` in a **Function or
 * Script** node is `window.Noodl`; `Noodl` in an **Expression** is the far
 * smaller object `createNoodlContext()` returns. The old array offered one
 * conflated list to both, so an expression author was offered `Noodl.Records`
 * (not there) and a Function author was told the API was three properties
 * wide.
 *
 * @module code-editor
 */

import type { ValidationType } from './utils/types';

/** A completion the editor can offer: what it is called, what kind, what it does. */
export interface ApiMember {
  label: string;
  type: 'property' | 'function' | 'namespace' | 'constant' | 'variable';
  info: string;
}

/**
 * Members of `window.Noodl`, as installed by `createNoodlAPI`
 * (`noodl-viewer-react/src/noodl-js-api.ts:19-76`). This is the object a
 * Function or Script node's `Noodl` refers to.
 */
export const NOODL_SCRIPT_API: readonly ApiMember[] = [
  { label: 'Variables', type: 'property', info: 'App-wide variables. `Noodl.Variables.name`' },
  { label: 'Objects', type: 'property', info: 'Objects by id. `Noodl.Objects.myId`' },
  { label: 'Arrays', type: 'property', info: 'Arrays by id. `Noodl.Arrays.myId`' },
  { label: 'Object', type: 'namespace', info: 'The Object/Model class. `Noodl.Object.get(id)`' },
  { label: 'Model', type: 'namespace', info: 'Alias of `Noodl.Object`' },
  { label: 'Array', type: 'namespace', info: 'The Array/Collection class. `Noodl.Array.get(id)`' },
  { label: 'Collection', type: 'namespace', info: 'Alias of `Noodl.Array`' },
  { label: 'Records', type: 'namespace', info: 'Backend records — query, create, save, delete' },
  { label: 'Users', type: 'namespace', info: 'Sign up, log in, and the current user' },
  { label: 'CloudFunctions', type: 'namespace', info: 'Call your cloud functions from code' },
  { label: 'Navigation', type: 'namespace', info: 'Navigate, and read the current route' },
  { label: 'Files', type: 'namespace', info: 'Upload and read files' },
  { label: 'Events', type: 'namespace', info: 'Send and receive app-wide events' },
  { label: 'eventEmitter', type: 'namespace', info: 'Alias of `Noodl.Events`' },
  { label: 'SEO', type: 'namespace', info: 'Page title and meta tags' },
  { label: 'Config', type: 'namespace', info: 'Values from project settings' },
  { label: 'Env', type: 'property', info: 'Environment values' },
  { label: 'getProjectSettings', type: 'function', info: 'Read the project settings object' },
  { label: 'getMetaData', type: 'function', info: 'Read a project metadata value by key' }
];

/**
 * Members of the `Noodl` an **Expression** sees — `createNoodlContext()` in
 * `noodl-runtime/src/expression-evaluator.ts:243-289`. Four properties, and
 * none of the rest of the API.
 */
export const NOODL_EXPRESSION_API: readonly ApiMember[] = [
  { label: 'Variables', type: 'property', info: 'App-wide variables. `Noodl.Variables.name`' },
  { label: 'Objects', type: 'property', info: 'Objects by id. `Noodl.Objects.myId`' },
  { label: 'Arrays', type: 'property', info: 'Arrays by id. `Noodl.Arrays.myId`' },
  { label: 'Object', type: 'namespace', info: 'The model scope. `Noodl.Object.get(id)`' }
];

/**
 * The maths an Expression can call, verbatim from `mathHelpers` in
 * `expression-evaluator.ts:47-63`. They are **parameters of the compiled
 * expression function** (`:275`) and exist nowhere else — offering `round` in a
 * Function node, as the old array did, offered a name that is not defined
 * there.
 */
export const EXPRESSION_MATH: readonly ApiMember[] = [
  { label: 'min', type: 'function', info: 'Math.min — the smallest of its arguments' },
  { label: 'max', type: 'function', info: 'Math.max — the largest of its arguments' },
  { label: 'cos', type: 'function', info: 'Math.cos — cosine, in radians' },
  { label: 'sin', type: 'function', info: 'Math.sin — sine, in radians' },
  { label: 'tan', type: 'function', info: 'Math.tan — tangent, in radians' },
  { label: 'sqrt', type: 'function', info: 'Math.sqrt — square root' },
  { label: 'pi', type: 'constant', info: 'Math.PI — 3.14159…' },
  { label: 'round', type: 'function', info: 'Math.round — to the nearest integer' },
  { label: 'floor', type: 'function', info: 'Math.floor — round down' },
  { label: 'ceil', type: 'function', info: 'Math.ceil — round up' },
  { label: 'abs', type: 'function', info: 'Math.abs — absolute value' },
  { label: 'random', type: 'function', info: 'Math.random — a number from 0 up to 1' },
  { label: 'pow', type: 'function', info: 'Math.pow — x to the power of y' },
  { label: 'log', type: 'function', info: 'Math.log — natural logarithm' },
  { label: 'exp', type: 'function', info: 'Math.exp — e to the power of x' }
];

/**
 * The names an Expression is compiled with —
 * `expression-evaluator.ts:275`'s `paramNames`. `Variables`, `Objects` and
 * `Arrays` are top-level here, which is why an expression can say `Variables.x`
 * without the `Noodl.` prefix.
 */
const EXPRESSION_GLOBALS: readonly ApiMember[] = [
  { label: 'Noodl', type: 'namespace', info: 'The Noodl namespace' },
  { label: 'Variables', type: 'property', info: 'App-wide variables — shorthand for `Noodl.Variables`' },
  { label: 'Objects', type: 'property', info: 'Objects by id — shorthand for `Noodl.Objects`' },
  { label: 'Arrays', type: 'property', info: 'Arrays by id — shorthand for `Noodl.Arrays`' },
  ...EXPRESSION_MATH
];

/**
 * The names a Function or Script node's body is compiled with:
 * `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)`
 * (`simplejavascript.ts:446-453`), plus `Script`, which the prefix declares
 * from `Node` (`javascriptnodeparser.js:492-494`).
 *
 * Note what is **not** here: `Props` and `State`, both of which the old array
 * offered. Neither is a parameter of that function and neither is a global —
 * completing them was an invitation to write code that throws.
 */
const SCRIPT_GLOBALS: readonly ApiMember[] = [
  { label: 'Inputs', type: 'property', info: "This node's input values. Reading `Inputs.x` creates the port" },
  { label: 'Outputs', type: 'property', info: "This node's outputs. Assigning `Outputs.y` creates the port" },
  { label: 'Noodl', type: 'namespace', info: 'The Noodl API' },
  { label: 'Component', type: 'property', info: 'The scope of the component this node sits in' },
  { label: 'Script', type: 'property', info: 'The script node itself, when there is one' }
];

/** Members of `Noodl.` in this mode. */
export function noodlMembersFor(validationType: ValidationType): readonly ApiMember[] {
  return validationType === 'expression' ? NOODL_EXPRESSION_API : NOODL_SCRIPT_API;
}

/** Top-level names this mode puts in scope. */
export function globalsFor(validationType: ValidationType): readonly ApiMember[] {
  return validationType === 'expression' ? EXPRESSION_GLOBALS : SCRIPT_GLOBALS;
}
