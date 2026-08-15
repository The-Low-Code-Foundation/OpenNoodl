/**
 * The Ports tab's live-value read-out — the rules, with no React and no socket.
 *
 * The channel itself is `getPortValues` (OBS-002 layer 1): the editor asks the
 * running preview for the *current* value of a batch of ports and the runtime
 * reads the ports themselves rather than a log of past sends. That is what lets
 * this work on a cold editor with nothing fired and on a port with no wire on
 * it — the two cases the older `debuginspectorvalues` channel cannot serve,
 * because its store is keyed by connection and only fills while debugging is
 * armed.
 *
 * Everything decided here is decided on the reply, so it is testable without a
 * runtime; `usePortValues` owns only the pulling.
 *
 * @module noodl-editor/views/panels/propertyeditor/components/PortsTab/portValues
 */

export type PortDirection = 'input' | 'output';

/** A port, addressed the way the runtime wants it. */
export interface PortValueRef {
  node: string;
  port: string;
  direction: PortDirection;
}

/** One entry of a `portValues` reply. `value` is already a preview string. */
export interface PortValueReply {
  node: string;
  port: string;
  direction: PortDirection;
  /** Whether the runtime found the port at all. */
  exists: boolean;
  value?: string;
}

/** Current values keyed by {@link portValueKey}. */
export type PortValueMap = Record<string, string>;

export interface PortValueState {
  values: PortValueMap;
  /**
   * Whether the runtime knows this node.
   *
   * Not the same as "the preview is running": a node in a component that is not
   * currently mounted is absent from a perfectly healthy preview, and telling
   * the author *that* is the difference between an empty read-out and a wrong
   * one.
   */
  nodeIsLive: boolean;
}

export const EMPTY_PORT_VALUES: PortValueState = { values: {}, nodeIsLive: false };

/** ⚠️ Direction is part of the key: a node may have `x` as both an input and an output. */
export function portValueKey(node: string, port: string, direction: PortDirection): string {
  return node + '|' + port + '|' + direction;
}

/**
 * Whether a port is worth asking about.
 *
 * A signal carries no value — reading one would report the internal sender —
 * and a port the runtime cannot name is not askable at all. Filtering here
 * rather than at render time keeps the request small: a `Group` has over a
 * hundred ports and the socket coalesces sends on a 200ms timer.
 */
export function isValuePort(port: { name?: string; isSignal?: boolean }): boolean {
  return typeof port.name === 'string' && port.name !== '' && !port.isSignal;
}

/**
 * Fold a reply into what the rows render.
 *
 * ⚠️ **An unset input is dropped, and that is not tidiness.** `getInputValue`
 * returns `_inputValues[name]` — what has been *set* on the port — while a node
 * whose input was never set behaves according to its own default, which lives
 * in the node's code and never passes through here. Rendering the literal
 * `undefined` on such a row would tell an author that `Width` is undefined
 * while the node is happily laying out at `100%`. Saying nothing is the only
 * honest option, and the row already reads as "no live value".
 *
 * An **output** is different and is kept: `OutputProperty#value` calls the
 * owner's getter on every read, so `undefined` there is the node's genuine
 * current answer — "nothing produced yet" — and is worth showing.
 */
export function foldPortValues(replies: readonly PortValueReply[], nodeId: string): PortValueState {
  const values: PortValueMap = {};
  let nodeIsLive = false;

  for (const entry of replies) {
    if (!entry || entry.node !== nodeId || !entry.exists) continue;
    // The port answered, so the runtime holds this node — whatever the value is.
    nodeIsLive = true;

    if (!isReportableValue(entry)) continue;
    values[portValueKey(entry.node, entry.port, entry.direction)] = entry.value as string;
  }

  return { values, nodeIsLive };
}

/**
 * Whether one answered port carries a value worth reporting — the rule spelled
 * out on {@link foldPortValues}, in one place because it now has two callers.
 *
 * FIX-001's Explain Mode reads the same channel for a *set* of nodes rather than
 * one, and gets this wrong in the same way if it re-derives it: an unset input
 * reported as `undefined` tells an author their `Width` is undefined while the
 * node lays out happily at its own default. That is the exact confident-wrong
 * answer both surfaces exist to avoid, so there is one copy of the rule.
 *
 * ⚠️ Assumes the caller has already checked `exists` — a port the runtime does
 * not have is a different fact (the node is not mounted) and is not this
 * function's to decide.
 */
export function isReportableValue(entry: PortValueReply): boolean {
  if (typeof entry.value !== 'string') return false;
  return !(entry.direction === 'input' && entry.value === 'undefined');
}

/**
 * What the read-out can honestly say about itself.
 *
 * `absent` and `waiting` are separated because they render the same empty rows
 * and mean opposite things: one is an answer, the other is the round trip not
 * having come back yet. Collapsing them put "this node is not on screen" on the
 * panel for a beat every time a node was selected — a confident wrong answer,
 * and the panel corrected itself a moment later, which is worse than saying
 * nothing.
 */
export type PortValuesStatus = 'no-preview' | 'waiting' | 'live' | 'absent';

export function portValuesStatus(input: {
  isPreviewRunning: boolean;
  hasAnswered: boolean;
  nodeIsLive: boolean;
}): PortValuesStatus {
  if (!input.isPreviewRunning) return 'no-preview';
  if (!input.hasAnswered) return 'waiting';
  return input.nodeIsLive ? 'live' : 'absent';
}

/**
 * Whether two folds say the same thing.
 *
 * The channel is a poll, so a reply arrives every second whether or not
 * anything moved, and a fresh object each time would re-render every row of a
 * hundred-port node once a second for nothing. Shallow is enough: the values
 * are strings by construction.
 */
export function samePortValues(a: PortValueState, b: PortValueState): boolean {
  if (a.nodeIsLive !== b.nodeIsLive) return false;

  const keys = Object.keys(a.values);
  if (keys.length !== Object.keys(b.values).length) return false;
  return keys.every((key) => a.values[key] === b.values[key]);
}
