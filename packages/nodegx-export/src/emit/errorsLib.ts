/**
 * `src/lib/errors.ts` — the runtime error channel, emitted into the app (EXP-011 §54).
 *
 * A transcription of `noodl-runtime/src/runtimeerror.ts` and of the `On App Error` node
 * (`onapperror.ts`), shipped whenever anything in the app can raise on it — a request verb's
 * failure arm, a Run Tasks host, a Script's load failure — or a component keeps a boundary.
 *
 * The Failure Contract's rule (`dev-docs/reference/FAILURE-CONTRACT.md`): *a node that goes wrong
 * says so at runtime, through a channel that exists in every runtime, in a structured form,
 * observable from the graph*. The channel is this module; "observable from the graph" is
 * `useAppError`, the boundary; and the deployed default — one structured console line per
 * failure, so nothing is ever fully silent — is the subscriber installed at module load, which is
 * what `createConsoleErrorSubscriber` is for every context without an editor attached.
 *
 * What is transcribed, and where it comes from: the event shape and the provenance a raise
 * carries (`Node.raiseRuntimeError`: the node's graph id, its component's name, its TYPE id);
 * synchronous delivery to a cloned subscriber list (a subscriber may unsubscribe during delivery);
 * a throwing subscriber logged and the rest still run; the depth guard (`MAX_DELIVERY_DEPTH = 2`)
 * that stops a boundary whose own chain raises from recursing until the stack gives out; the
 * boundary's code-prefix `Filter`, empty meaning everything; its value outputs updated BEFORE its
 * `Error` signal fires (`flagOutputDirty` × 6, then `sendSignalOnOutput('error')`); and that every
 * boundary fires — there is no claiming.
 *
 * What differs, recorded rather than hidden: the boundary arms in a layout effect rather than at
 * node creation (the earliest moment a hook can subscribe; it is before every passive effect in
 * the tree, which is where the requests, the Script hosts and the task templates run); a throw
 * during a render pass itself (a Function node's body) reaches the console only, because a raise
 * per render through a chain that sets state would be a render loop.
 */

export const ERRORS_LIB_PATH = 'src/lib/errors.ts';

export function errorsLibSource(): string {
  return [
    '//',
    '// The runtime error channel, and the On App Error boundary over it. Transcribed from the runtime it has to',
    '// agree with: noodl-runtime/src/runtimeerror.ts (the bus, the depth guard, the console default) and',
    '// noodl-runtime/src/nodes/std-library/onapperror.ts (the boundary: a code-prefix filter, values before the',
    '// signal, every instance fires).',
    '//',
    '// raiseAppError(error): what a node does when it was asked to act and could not — the request verbs\'',
    '// failure arms, a Run Tasks host, a Script that could not load. `code` is the stable, kebab-case,',
    '// per-node-type identifier to match on; `message` is for people and may be reworded; the three',
    '// provenance fields are the node\'s graph id, its component\'s name and its type id, as the runtime fills',
    '// them in. Delivery is synchronous: a boundary\'s chain runs before the raising site continues, which is',
    '// what lets a Failure chain wired beside it read the reason when its own pulse lands.',
    '//',
    '// useAppError({ filter }, onError): the boundary. `filter` is a code prefix (`run-tasks` catches every',
    '// failure Run Tasks can report, `run-tasks/task-failed` exactly one); empty catches everything. The',
    '// handle\'s `last` is the latest accepted error — updated, and the component re-rendered, BEFORE `onError`',
    '// runs, so a chain reading Message on the pulse sees this error\'s message. Every boundary fires; nothing',
    '// consumes.',
    '//',
    '// Recorded divergences: the boundary arms in a layout effect (before every passive effect in the tree)',
    '// rather than at node creation; a throw inside a render pass reaches the console only.',
    '//',
    '',
    "import { useLayoutEffect, useReducer, useRef } from 'react';",
    '',
    '/** One raised failure, structured — the runtime\'s RuntimeErrorEvent. */',
    'export interface AppError {',
    '  /** Stable kebab-case identifier for this kind of error, namespaced by node type — `run-tasks/task-failed`. */',
    '  code: string;',
    '  /** Human-readable account of what went wrong; match on `code`, not on this. */',
    '  message: string;',
    '  /** Graph id of the node that raised, or `<runtime>` when it was raised outside any node. */',
    '  nodeId: string;',
    '  /** The component the node sits in — `/Pages/Home` — or `<runtime>`. */',
    '  componentName: string;',
    '  /** The type id of the node that raised — `CloudFunction2`, `RunTasks` — or `<runtime>`. */',
    '  nodeType: string;',
    '  /** Structured payload: the caught error, the offending value. Must be safe to serialise. */',
    '  detail?: unknown;',
    '}',
    '',
    'export type AppErrorSubscriber = (error: AppError) => void;',
    '',
    '/**',
    ' * How deep a raise-inside-a-subscriber chain may go before events are dropped. A boundary whose own',
    ' * chain raises would otherwise recurse until the stack gives out; two levels is enough for "the error',
    ' * handler had a problem" to be reported once.',
    ' */',
    'const MAX_DELIVERY_DEPTH = 2;',
    '',
    'const subscribers: AppErrorSubscriber[] = [];',
    'let depth = 0;',
    '',
    '/** Subscribe; the returned function unsubscribes. Safe to call during delivery — the loop runs over a clone. */',
    'export function subscribeAppErrors(subscriber: AppErrorSubscriber): () => void {',
    '  subscribers.push(subscriber);',
    '  return () => {',
    '    const index = subscribers.indexOf(subscriber);',
    '    if (index !== -1) subscribers.splice(index, 1);',
    '  };',
    '}',
    '',
    '/** Raise a failure. Every subscriber runs, synchronously, in subscription order; one that throws does not stop the rest. */',
    'export function raiseAppError(error: AppError): void {',
    '  if (depth >= MAX_DELIVERY_DEPTH) {',
    '    // Past this point a subscriber is failing in response to a failure. Report it on the one channel that',
    '    // cannot recurse and stop, rather than growing the stack.',
    "    console.error('runtime error raised while delivering another; dropped', error);",
    '    return;',
    '  }',
    '  const current = subscribers.slice();',
    '  depth++;',
    '  try {',
    '    for (const subscriber of current) {',
    '      try {',
    '        subscriber(error);',
    '      } catch (e) {',
    '        // One bad subscriber must not stop the rest — that is the failure mode this channel exists to remove.',
    "        console.error('a runtime-error subscriber threw', e);",
    '      }',
    '    }',
    '  } finally {',
    '    depth--;',
    '  }',
    '}',
    '',
    '// The deployed default: one structured line per failure, so a failure is never fully silent even in an app',
    '// where nobody wired a Failure output or placed an On App Error (createConsoleErrorSubscriber).',
    'subscribeAppErrors((error) => {',
    "  console.error(error.nodeType + ' (' + error.componentName + '): ' + error.message + ' [' + error.code + ']', error);",
    '});',
    '',
    'export interface AppErrorOptions {',
    '  /**',
    '   * Only errors whose code starts with this text are reported; empty or absent catches every error in the app.',
    "   * Coerced as the node's own setter coerces: undefined and null clear it, anything else is String(value).",
    '   */',
    '  filter?: unknown;',
    '}',
    '',
    'export interface AppErrorHandle {',
    '  /** The latest error this boundary accepted — its Message, Code, Node Id, Component Name, Node Type and Error Object. */',
    '  readonly last: AppError | undefined;',
    '}',
    '',
    '/**',
    ' * The On App Error node: a boundary over every error raised in the app while the component that hosts it',
    ' * is mounted. `onError` is the chain wired off its Error output; the handle\'s `last` is what its value',
    ' * outputs read, and it is current before `onError` runs.',
    ' */',
    'export function useAppError(options: AppErrorOptions = {}, onError?: (error: AppError) => void): AppErrorHandle {',
    '  const [, publish] = useReducer((n: number) => n + 1, 0);',
    '  const optionsRef = useRef(options);',
    '  optionsRef.current = options;',
    '  const onRef = useRef(onError);',
    '  onRef.current = onError;',
    '  const last = useRef<AppError | undefined>(undefined);',
    '  const handle = useRef<AppErrorHandle | null>(null);',
    '  if (handle.current === null) {',
    '    handle.current = {',
    '      get last() {',
    '        return last.current;',
    '      }',
    '    };',
    '  }',
    '  // Armed in a layout effect: before any passive effect in the tree runs — the requests, a Script host\'s',
    "  // mount, a task template's start chain — which is the closest a hook comes to subscribing at node",
    '  // creation, where the runtime does it. Unsubscribes when the host unmounts, as the node does on delete.',
    '  useLayoutEffect(',
    '    () =>',
    '      subscribeAppErrors((error) => {',
    '        const raw = optionsRef.current.filter;',
    '        const filter = raw === undefined || raw === null ? undefined : String(raw);',
    '        if (filter && error.code.indexOf(filter) !== 0) return;',
    '        // Values before the signal, always: the value outputs describe THIS error when the pulse lands.',
    '        last.current = error;',
    '        publish();',
    '        onRef.current?.(error);',
    '      }),',
    '    []',
    '  );',
    '  return handle.current;',
    '}',
    ''
  ].join('\n');
}
