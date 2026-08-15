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
  /**
   * What this member's own `.` offers, when that is knowable statically.
   *
   * FIX-017 §B. Absent means "this source does not know", which is a different
   * claim from "it has no members" — `Noodl.Variables` has members and they are
   * the *project's*, so they are answered from the authoring context instead
   * (see `resolveNamespace` in `noodl-completions.ts`), never from here.
   */
  members?: readonly ApiMember[];
}

/**
 * `Noodl.Records` — the object `createRecordsAPI()` returns
 * (`noodl-runtime/src/api/records.js`). Every one of the eleven is async.
 *
 * ⚠️ Read off `records.js`, **not** the generated `records.d.ts` that
 * FIX-017 §B recommended as "generated — best". That file is real and it is
 * accurate, but `packages/noodl-runtime/dist-types` is **gitignored**
 * (`.gitignore:225`), so a citation to it cannot be checked on a fresh clone —
 * the reader is told to look at a file that is not there. Cite the source that
 * ships.
 */
const RECORDS_MEMBERS: readonly ApiMember[] = [
  { label: 'query', type: 'function', info: 'query(className, query, options) — find records matching a query.' },
  { label: 'count', type: 'function', info: 'count(className, query) — how many records match.' },
  { label: 'distinct', type: 'function', info: 'distinct(className, property, query) — the distinct values of a property.' },
  { label: 'aggregate', type: 'function', info: 'aggregate(className, group, query) — grouped totals.' },
  { label: 'fetch', type: 'function', info: 'fetch(objectOrId, options) — re-read one record from the backend.' },
  { label: 'increment', type: 'function', info: 'increment(objectOrId, properties, options) — add to numeric properties atomically.' },
  { label: 'save', type: 'function', info: 'save(objectOrId, properties, options) — write changes to an existing record.' },
  { label: 'create', type: 'function', info: 'create(className, properties, options) — make a new record.' },
  { label: 'delete', type: 'function', info: 'delete(objectOrId, options) — remove a record.' },
  { label: 'addRelation', type: 'function', info: 'addRelation(options) — relate one record to another.' },
  { label: 'removeRelation', type: 'function', info: 'removeRelation(options) — unrelate two records.' }
];

/** `Noodl.Users` — `noodl-viewer-react/src/api/users.ts`, the `UsersApi` interface. */
const USERS_MEMBERS: readonly ApiMember[] = [
  { label: 'logIn', type: 'function', info: 'logIn({ username, password }) — sign a user in.' },
  { label: 'signUp', type: 'function', info: 'signUp({ username, password, ... }) — create an account and sign in.' },
  { label: 'become', type: 'function', info: 'become(sessionToken) — adopt an existing session.' },
  { label: 'on', type: 'function', info: 'on(event, callback) — listen for sign-in / sign-out.' },
  { label: 'off', type: 'function', info: 'off(event, callback) — stop listening.' },
  {
    label: 'Current',
    type: 'property',
    // Capital C, and undefined when signed out — both are the kind of thing a
    // remembered list gets wrong. `users.ts:40`.
    info: 'The signed-in user, or undefined when nobody is. `Noodl.Users.Current.email`'
  }
];

/** `Noodl.CloudFunctions` — `noodl-viewer-react/src/api/cloudfunctions.ts`. */
const CLOUD_FUNCTIONS_MEMBERS: readonly ApiMember[] = [
  { label: 'run', type: 'function', info: 'run(functionName, params) — call a backend function and await its result.' }
];

/** `Noodl.Navigation` — `noodl-viewer-react/src/api/navigation.ts`. */
const NAVIGATION_MEMBERS: readonly ApiMember[] = [
  { label: 'navigate', type: 'function', info: 'navigate(routerName, targetPageName, params) — go to a page in a router.' },
  { label: 'navigateToPath', type: 'function', info: 'navigateToPath(path, { query }) — go to a URL path.' },
  { label: 'showPopup', type: 'function', info: 'showPopup(componentPath, params) — open a popup and await how it closed.' }
];

/** `Noodl.Files` — `noodl-viewer-react/src/api/files.ts`. One method. */
const FILES_MEMBERS: readonly ApiMember[] = [
  { label: 'upload', type: 'function', info: 'upload(file, { onProgress }) — upload a File or Blob, resolving to a CloudFile.' }
];

/** `Noodl.SEO` — the `SeoApi` class, `noodl-viewer-react/src/api/seo.ts`. */
const SEO_MEMBERS: readonly ApiMember[] = [
  { label: 'setTitle', type: 'function', info: 'setTitle(value) — set the page title.' },
  { label: 'setMeta', type: 'function', info: 'setMeta(key, value) — set one meta tag.' },
  { label: 'getMeta', type: 'function', info: 'getMeta(key) — read one meta tag.' },
  { label: 'clearMeta', type: 'function', info: 'clearMeta() — remove the meta tags this API set.' },
  { label: 'reset', type: 'function', info: 'reset() — back to the document defaults.' }
];

/**
 * `Noodl.Config` — the **fixed** keys `buildFlatConfig` always writes
 * (`noodl-viewer-react/src/api/config.ts:35-59`).
 *
 * ⚠️ Deliberately partial, and that is the honest shape. `Config` is a Proxy,
 * and the same flat object also carries every custom variable from App Setup —
 * names this file cannot know. So the list below is a floor, never a contents
 * page: a name missing from it may still be real. Offering it as complete would
 * teach a user that their own config variable does not exist.
 */
const CONFIG_MEMBERS: readonly ApiMember[] = [
  { label: 'appName', type: 'property', info: 'App name, from App Setup → Identity.' },
  { label: 'description', type: 'property', info: 'App description, from App Setup → Identity.' },
  { label: 'coverImage', type: 'property', info: 'Cover image, from App Setup → Identity.' },
  { label: 'ogTitle', type: 'property', info: 'Open Graph title. Falls back to `appName`.' },
  { label: 'ogDescription', type: 'property', info: 'Open Graph description. Falls back to `description`.' },
  { label: 'ogImage', type: 'property', info: 'Open Graph image. Falls back to `coverImage`.' },
  { label: 'favicon', type: 'property', info: 'Favicon URL, from App Setup → SEO.' },
  { label: 'themeColor', type: 'property', info: 'Theme colour, from App Setup → SEO.' },
  { label: 'pwaEnabled', type: 'property', info: 'Whether the PWA manifest is on.' },
  { label: 'pwaShortName', type: 'property', info: 'PWA short name.' },
  { label: 'pwaDisplay', type: 'property', info: 'PWA display mode.' },
  { label: 'pwaStartUrl', type: 'property', info: 'PWA start URL.' },
  { label: 'pwaBackgroundColor', type: 'property', info: 'PWA background colour.' }
];

/**
 * The statics on `Noodl.Object` / `Noodl.Model` — `noodl-runtime/src/model.ts`
 * (FIX-017 §B cited `model.js`; it is TypeScript now).
 */
const MODEL_MEMBERS: readonly ApiMember[] = [
  { label: 'get', type: 'function', info: 'get(id) — the object with this id, created if it does not exist yet.' },
  { label: 'create', type: 'function', info: 'create(data) — a new object with a generated id.' },
  { label: 'exists', type: 'function', info: 'exists(id) — whether an object with this id has been made.' },
  { label: 'instanceOf', type: 'function', info: 'instanceOf(value) — whether a value is a Noodl Object.' }
];

/** The statics on `Noodl.Array` / `Noodl.Collection` — `noodl-runtime/src/collection.ts`. */
const COLLECTION_MEMBERS: readonly ApiMember[] = [
  { label: 'get', type: 'function', info: 'get(name) — the array with this id, created if it does not exist yet.' },
  { label: 'create', type: 'function', info: 'create(items) — a new array holding these items.' },
  { label: 'exists', type: 'function', info: 'exists(name) — whether an array with this id has been made.' },
  { label: 'instanceOf', type: 'function', info: 'instanceOf(value) — whether a value is a Noodl Array.' }
];

/**
 * `Noodl.Events` — `nodecontext.ts:225`'s `eventSenderEmitter`, which is
 * `noodl-runtime/src/events.js`: a vendored copy of Node's `EventEmitter`, so
 * these four are the same four. The channel is the event name a Send Event /
 * Receive Event node uses.
 */
const EVENTS_MEMBERS: readonly ApiMember[] = [
  { label: 'emit', type: 'function', info: 'emit(channel, payload) — send an app-wide event.' },
  { label: 'on', type: 'function', info: 'on(channel, listener) — receive events on a channel.' },
  { label: 'once', type: 'function', info: 'once(channel, listener) — receive the next event only.' },
  { label: 'off', type: 'function', info: 'off(channel, listener) — stop receiving.' }
];

/**
 * Members of `window.Noodl`, as installed by `createNoodlAPI`
 * (`noodl-viewer-react/src/noodl-js-api.ts:19-76`). This is the object a
 * Function or Script node's `Noodl` refers to.
 */
export const NOODL_SCRIPT_API: readonly ApiMember[] = [
  { label: 'Variables', type: 'property', info: 'App-wide variables. `Noodl.Variables.name`' },
  { label: 'Objects', type: 'property', info: 'Objects by id. `Noodl.Objects.myId`' },
  { label: 'Arrays', type: 'property', info: 'Arrays by id. `Noodl.Arrays.myId`' },
  { label: 'Object', type: 'namespace', info: 'The Object/Model class. `Noodl.Object.get(id)`', members: MODEL_MEMBERS },
  { label: 'Model', type: 'namespace', info: 'Alias of `Noodl.Object`', members: MODEL_MEMBERS },
  { label: 'Array', type: 'namespace', info: 'The Array/Collection class. `Noodl.Array.get(id)`', members: COLLECTION_MEMBERS },
  { label: 'Collection', type: 'namespace', info: 'Alias of `Noodl.Array`', members: COLLECTION_MEMBERS },
  { label: 'Records', type: 'namespace', info: 'Backend records — query, create, save, delete', members: RECORDS_MEMBERS },
  { label: 'Users', type: 'namespace', info: 'Sign up, log in, and the current user', members: USERS_MEMBERS },
  { label: 'CloudFunctions', type: 'namespace', info: 'Call your cloud functions from code', members: CLOUD_FUNCTIONS_MEMBERS },
  { label: 'Navigation', type: 'namespace', info: 'Navigate, and read the current route', members: NAVIGATION_MEMBERS },
  { label: 'Files', type: 'namespace', info: 'Upload and read files', members: FILES_MEMBERS },
  { label: 'Events', type: 'namespace', info: 'Send and receive app-wide events', members: EVENTS_MEMBERS },
  { label: 'eventEmitter', type: 'namespace', info: 'Alias of `Noodl.Events`', members: EVENTS_MEMBERS },
  { label: 'SEO', type: 'namespace', info: 'Page title and meta tags', members: SEO_MEMBERS },
  {
    label: 'Config',
    type: 'namespace',
    info: 'Values from App Setup, plus your own config variables',
    members: CONFIG_MEMBERS
  },
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

/**
 * The members of a dotted path — `Noodl`, `Noodl.Records`, and no deeper today.
 *
 * FIX-017 §B. `Noodl.` has answered since FH-019, but every namespace it named
 * answered `null` at its own dot: a beginner who took the editor's advice and
 * typed `Noodl.Records` was then handed nothing, which reads as "there is
 * nothing here" rather than "I only know one level".
 *
 * Anchored at `Noodl` on purpose. `Object.` and `Array.` are the *JavaScript*
 * globals in a Function body, and answering for the bare form would offer
 * `Noodl.Object`'s statics for `Object.keys` — a wrong answer in place of the
 * language's right one. Expression mode needs no special case: its `Noodl` has
 * four members and none of them carries a second level, so the walk stops of
 * its own accord.
 *
 * Returns `null` for a path this file does not know, which is the signal the
 * caller needs to let another completion source answer.
 */
export function apiMembersAtPath(path: string, validationType: ValidationType): readonly ApiMember[] | null {
  const segments = path.split('.');
  if (segments[0] !== 'Noodl') return null;

  let members = noodlMembersFor(validationType);

  for (const segment of segments.slice(1)) {
    const match = members.find((member) => member.label === segment);
    if (!match || !match.members) return null;
    members = match.members;
  }

  return members;
}
