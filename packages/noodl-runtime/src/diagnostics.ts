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
