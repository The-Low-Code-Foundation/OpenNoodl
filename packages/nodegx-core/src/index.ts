/**
 * `@nodegx/core` — the reactive primitives an exported NodeGX project depends on.
 *
 * The semantics these preserve are written down in `CONTRACT.md`, read from the interpreted
 * runtime's own source. The API was derived by hand-writing the exported code we wanted first; that
 * exercise is `dev-docs/tasks/phase-18-code-export-v2/EXP-001-TARGET-OUTPUT.md`.
 *
 * React bindings live at `@nodegx/core/react` so a non-React consumer never pulls React in.
 */

export { Value, value, type Readable } from './value';
export { Derived, derived, untracked } from './derived';
export { Signal, signal } from './signal';
export { Store, store, clearStores } from './store';
export { Collection, collection } from './collection';
export { channel, events, clearChannels } from './events';
export { effect } from './effect';
export { batch, flushSync, configureRuntime, resetRuntime, CyclicUpdateError, type RuntimeOptions } from './internal';
