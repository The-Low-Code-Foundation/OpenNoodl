'use strict';

/**
 * Node-local diagnostics — see `dev-docs/reference/DIAGNOSTICS-CONTRACT.md`.
 *
 * A **diagnostic** is a predicate on a node's current input or configuration: *"`Items` is not an
 * array"*, *"this input holds NaN"*. It is true continuously, from the moment the condition arises
 * until the author changes something.
 *
 * That is what separates it from a **failure** (`runtimeerror.ts`), which is an *event* — the node
 * was asked to act and could not. A failure belongs on the runtime error bus, where it reaches
 * `On App Error` and a deployed app's console. A diagnostic does not: it never "happened", so it
 * would fire the error node repeatedly for nothing, and the only person who can act on it is the
 * author, in the editor.
 *
 * Hence one channel, one API, and a *setter* rather than a report/clear pair — the same statement
 * that raises a diagnostic clears it, so a stale warning is not something a call site can forget.
 */

import type { EditorConnectionLike } from '@noodl/types';

/** What {@link setDiagnostic} needs off a node. `Node` satisfies this structurally. */
export interface DiagnosticHost {
  id: string;
  context?: {
    editorConnection?: EditorConnectionLike;
  };
  nodeScope?: {
    componentOwner?: { name?: string };
  };
}

/** The `clearWarning` half of the channel, which older editor-connection stubs may not have. */
interface WarningChannel {
  isRunningLocally?(): boolean;
  sendWarning(componentName: string, nodeId: string, key: string, warning: unknown): void;
  clearWarning?(componentName: string, nodeId: string, key: string): void;
}

/**
 * Whether diagnostics will do anything at all, for a call site whose *predicate* — not merely its
 * message — is expensive enough to be worth skipping.
 *
 * ⚠️ The gate is `isRunningLocally()`, **not** `if (context.editorConnection)`. A deployed build
 * constructs an `EditorConnection` anyway and deliberately so (`noodl-runtime.ts:286-295`, *"reduce
 * the need for lots of if(editorConnection)"*), so the usual guard is *true in production* and
 * everything behind it is formatted, serialised and pushed onto a queue that never drains.
 *
 * A connection with no `isRunningLocally` at all is treated as enabled: that is a test harness or
 * an embedding host, and both want to observe what the node reported.
 */
export function diagnosticsEnabled(host: DiagnosticHost): boolean {
  const editorConnection = host.context && (host.context.editorConnection as WarningChannel | undefined);
  if (!editorConnection) return false;
  if (typeof editorConnection.isRunningLocally !== 'function') return true;
  return editorConnection.isRunningLocally();
}

/**
 * Report — or withdraw — one node-local diagnostic.
 *
 * @param key     `<node-type>/<condition>`, kebab-case, optionally `/<port>` — the same namespace
 *                as `raiseRuntimeError` codes, so tooling matches both the same way. It must never
 *                carry a *value*: an unbounded key space can never be cleared, because nothing
 *                downstream can name a key it did not mint.
 * @param message One sentence. Falsy — `null`, `undefined`, `''` — means the predicate does not
 *                hold, and clears.
 */
export function setDiagnostic(host: DiagnosticHost, key: string, message?: string | null): void {
  const editorConnection = host.context && (host.context.editorConnection as WarningChannel | undefined);
  if (!editorConnection) return;
  if (typeof editorConnection.isRunningLocally === 'function' && !editorConnection.isRunningLocally()) return;

  // Best-effort, exactly as `Node.raiseRuntimeError` does it: a node without a component owner
  // still has an id, and a missing name must not turn a diagnostic into a thrown TypeError.
  let componentName = '<unknown>';
  try {
    if (host.nodeScope && host.nodeScope.componentOwner && host.nodeScope.componentOwner.name) {
      componentName = host.nodeScope.componentOwner.name;
    }
  } catch (e) {
    /* provenance is best-effort; the warning still carries the node id */
  }

  if (message) {
    editorConnection.sendWarning(componentName, host.id, key, {
      showGlobally: true,
      message
    });
  } else if (editorConnection.clearWarning) {
    editorConnection.clearWarning(componentName, host.id, key);
  }
}

/** Longest value excerpt a diagnostic message will quote, so one bad payload cannot fill the panel. */
const MAX_EXCERPT = 40;

/**
 * Name a value the way a diagnostic message wants it: *what it is*, then *what it was*.
 *
 * "received a string" is what makes the message actionable — the author wired the wrong port — and
 * the excerpt is what makes it findable. Both, briefly.
 */
export function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'nothing';

  if (Array.isArray(value)) {
    return value.length === 1 ? 'an array of 1 item' : `an array of ${value.length} items`;
  }

  const type = typeof value;

  if (type === 'string') {
    const text = value as string;
    const excerpt = text.length > MAX_EXCERPT ? text.slice(0, MAX_EXCERPT) + '…' : text;
    return `a string ("${excerpt}")`;
  }

  if (type === 'number') {
    // NaN is a number and describing it as one is useless; it is the whole point of the message.
    return (value as number) !== (value as number) ? 'NaN' : `a number (${value})`;
  }

  if (type === 'boolean') return `a boolean (${value})`;
  if (type === 'function') return 'a function';
  if (type === 'object') return 'an object';

  return `a ${type}`;
}

/**
 * How far apart two names are, capped so a long pair cannot cost more than the check is worth.
 *
 * Plain Levenshtein over two rows. It runs only where a name has *already* failed to match, so
 * it is off every hot path by construction.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/** Beyond this many candidates the suggestion is not worth the scan, and probably not worth reading. */
const MAX_CANDIDATES = 64;

/**
 * The candidate an author most likely meant, or `undefined` when nothing is close enough.
 *
 * The phase-36 worked example is the whole reason this exists: a States node receives `"Clicked"`
 * and the state is named `"clicked"`. Listing the real names already made that solvable — by an
 * author who read the list carefully and spotted one capital letter, which is exactly the reading
 * nobody does at the end of an afternoon.
 *
 * Case and surrounding whitespace are ranked ahead of edit distance because they are the two
 * mistakes that are *invisible* in the editor: a trailing space in a text field looks like
 * nothing at all, and a capital in a name read at a glance looks like the name.
 *
 * ⚠️ **Returns `undefined` rather than the least-bad candidate.** A suggestion that is merely the
 * closest of several unrelated names is worse than none: it sends the author to a name they never
 * typed, and the next thing they doubt is the diagnostic.
 */
export function nearestName(name: string, candidates: readonly string[]): string | undefined {
  if (typeof name !== 'string' || !name.length || !candidates || !candidates.length) return undefined;
  if (candidates.length > MAX_CANDIDATES) return undefined;

  const normalised = name.trim().toLowerCase();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (typeof candidate === 'string' && candidate.trim().toLowerCase() === normalised) return candidate;
  }

  // One edit for a short name, two for anything long enough that two typos are still plausibly
  // one word. Unbounded distance is how "did you mean" starts suggesting nonsense.
  const budget = normalised.length <= 4 ? 1 : 2;

  let best: string | undefined;
  let bestDistance = budget + 1;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (typeof candidate !== 'string') continue;

    const distance = editDistance(normalised, candidate.trim().toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    } else if (distance === bestDistance) {
      // A tie means two candidates are equally plausible, and naming either is a guess.
      best = undefined;
    }
  }

  return bestDistance <= budget ? best : undefined;
}
