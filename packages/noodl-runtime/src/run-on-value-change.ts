'use strict';

/**
 * NDA-017 §2 — per-input "Run on value change".
 *
 * ## What this replaces
 *
 * Twelve node families share one idiom: connect the node's control signal and every value
 * setter goes passive.
 *
 * ```ts
 * set: function (value) {
 *   this._internal.scope[name] = value;
 *   if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
 * }
 * ```
 *
 * The community report that opened NDA-017 read this as a staleness bug, and the spec
 * followed — it offered never-arrived detection, an upstream-pending concept in the runtime,
 * documentation, or nothing. Richard rejected all four on 2026-08-01 because the defect is
 * one level deeper than any of them addresses: **connecting `Run` silently changes what
 * every other port does.** The node flips from "recalculate whenever an input changes" to
 * "never recalculate", and nothing in the property panel says so. Authors who notice
 * hand-build a `Value Changed` node behind `Run` to restore a behaviour that wiring an
 * unrelated port took away; authors who do not, ship the stale value.
 *
 * So the guard above becomes a *declared, per-input* choice:
 *
 * ```ts
 * set: function (value) {
 *   this._internal.scope[name] = value;
 *   if (this.shouldRunOnValueChange(name)) this._scheduleEvaluateExpression();
 * }
 * ```
 *
 * ## The four constraints, and why each is a way to get this wrong
 *
 * 1. **`Run` is purely additive.** The checkboxes are the *only* thing governing auto-run.
 *    Wiring `Run` adds a trigger and never un-ticks anything. Auto-clearing the boxes when a
 *    connection appears would make the trap *visible* rather than remove it — the author
 *    would still be reading a panel that changed underneath them.
 * 2. **Default is every input ticked.** That is today's behaviour for a node with no `Run`
 *    wired, so nothing changes until an author deliberately unticks. Note that the default
 *    cannot be carried by a declared `default` on the port: a declared default never runs
 *    its setter (phase 30 finding A-D1), so {@link runOnValueChange} has to read *absent* as
 *    ticked rather than relying on a seed value having been written.
 * 3. **Several ticked inputs changing in one frame produce one run, not three.** Every
 *    family already owns a `hasScheduled…` flag for this; the checkbox must gate the call to
 *    the scheduler, never replace it with a direct evaluation.
 * 4. **A node that has never evaluated reports `null`.** This one is not about the
 *    checkboxes at all — it answers the companion question §0 found. With the control signal
 *    connected the node never evaluates at boot, yet `connectInput` still pushes the
 *    result getter's initial `cachedValue` downstream, so a consumer reads a confident `0`
 *    from a node that has never run. See {@link neverEvaluated}.
 *
 * ## What `Run` is still for
 *
 * Kept, and not vestigial: an async re-fetch that returns an *identical* value fires no
 * change, so a node that must re-run once per fetch still wires `Run` to the producer's
 * completion signal. That is the correct dataflow answer (the spec's option C) and it now
 * coexists with the checkboxes instead of fighting them.
 *
 * ## The port shape, and why a port rather than a bespoke control
 *
 * One `boolean` input per governed value input, named `runOnChange-<inputName>`, grouped
 * under {@link RUN_ON_CHANGE_GROUP} and marked `allowEditOnly` so it cannot be wired. That
 * costs no new property-editor type, persists as an ordinary parameter, and is visible to
 * the catalog, the semantic validator and the MCP server for free.
 *
 * ⚠️ The port name is recovered with {@link inputNameForRunOnChangePort}, which slices the
 * prefix. Never `split('-')`: the governed input may itself contain a hyphen — the Function
 * node's script inputs are registered as `in-<name>`, so its checkbox is
 * `runOnChange-in-<name>` — and splitting is the port-name class of defect NDA-012 filed
 * against four nodes already.
 */

import type { InputPortDefinition, NodeInstance, RuntimeDiscoveredPort } from '@noodl/types';

/** Prefix identifying a "run on value change" checkbox port. */
export const RUN_ON_CHANGE_PREFIX = 'runOnChange-';

/** Property-panel group the checkboxes live in, on every node in the class. */
export const RUN_ON_CHANGE_GROUP = 'Run On Value Change';

/** The checkbox port governing `inputName`. */
export function runOnChangePortName(inputName: string): string {
  return RUN_ON_CHANGE_PREFIX + inputName;
}

/**
 * The governed input a checkbox port belongs to, or `undefined` if this is not one.
 *
 * Sliced rather than split — see the note in the module comment.
 */
export function inputNameForRunOnChangePort(portName: string): string | undefined {
  if (portName.indexOf(RUN_ON_CHANGE_PREFIX) !== 0) return undefined;
  const inputName = portName.slice(RUN_ON_CHANGE_PREFIX.length);
  return inputName.length > 0 ? inputName : undefined;
}

/**
 * The checkbox port definition for one governed input.
 *
 * `displayName` is the governed port's own label, because the group heading already says
 * what the column of checkboxes means; repeating "Run on change of…" in every row reads as
 * noise in a panel that may show a dozen of them.
 *
 * ⚠️ **`default: true` is declared, and the reason is the interesting half of A-D1.**
 *
 * The first cut of this left the default off, reasoning that a declared default never runs
 * its setter so it could only be decoration. Live QA in the editor showed what that
 * decoration is for: with no default, the property panel rendered **both boxes unchecked** on
 * a node whose runtime behaviour was ticked. The affordance said "off" while the node ran on.
 * That is worse than the trap it replaced, because at least the old trap was invisible rather
 * than actively wrong.
 *
 * So the two halves are declared separately *because* A-D1 is true, not despite it:
 *
 * - `default: true` is what the **panel** reads. It never runs a setter and never reaches the
 *   value path, which is exactly what makes it safe here.
 * - {@link runOnValueChange} reading absent-as-ticked is what the **runtime** obeys, and it
 *   has to, precisely because the default's setter never runs.
 *
 * Neither can be dropped, and either alone is a node whose panel and behaviour disagree.
 */
export function runOnChangeInput(inputName: string, displayName?: string): InputPortDefinition {
  return {
    group: RUN_ON_CHANGE_GROUP,
    displayName: displayName || inputName,
    default: true,
    type: { name: 'boolean', allowEditOnly: true } as never,
    description:
      'Whether a new value on ' +
      (displayName || inputName) +
      ' re-runs this node. On by default; untick to make this input passive so only the control signal runs it',
    set: function (this: NodeInstance, value: unknown) {
      setRunOnValueChange(this, inputName, value !== false);
    }
  };
}

/** The checkbox ports for a whole set of governed inputs, ready to spread into `inputs`. */
export function runOnChangeInputs(
  inputNames: string[],
  displayNames?: Record<string, string>
): Record<string, InputPortDefinition> {
  const inputs: Record<string, InputPortDefinition> = {};
  inputNames.forEach(function (name) {
    inputs[runOnChangePortName(name)] = runOnChangeInput(name, displayNames && displayNames[name]);
  });
  return inputs;
}

/**
 * The same ports in the shape `editorConnection.sendDynamicPorts` wants.
 *
 * Used by the four families whose governed inputs are discovered rather than declared —
 * Expression and Function from user text, Query Records and Filter Records from the schema.
 */
export function runOnChangeDynamicPorts(
  inputNames: string[],
  displayNames?: Record<string, string>
): RuntimeDiscoveredPort[] {
  return inputNames.map(function (name) {
    const displayName = (displayNames && displayNames[name]) || name;
    return {
      name: runOnChangePortName(name),
      displayName: displayName,
      group: RUN_ON_CHANGE_GROUP,
      plug: 'input',
      // See `runOnChangeInput` for why this is declared even though its setter never runs.
      // The dynamic-port path is where the missing default was actually caught, on an
      // Expression whose two boxes rendered unchecked while the node ran on both inputs.
      default: true,
      type: { name: 'boolean', allowEditOnly: true }
    };
  });
}

/**
 * Whether a new value on `inputName` should re-run the node.
 *
 * **Absent means ticked.** Constraint 2 above: an author who has never touched the panel
 * gets today's no-`Run` behaviour, and the state map only ever holds deliberate answers.
 */
export function runOnValueChange(node: NodeInstance, inputName: string): boolean {
  const state = (node as unknown as { _runOnValueChange?: Record<string, boolean> })._runOnValueChange;
  return !state || state[inputName] !== false;
}

/** Record a deliberate answer for `inputName`. */
export function setRunOnValueChange(node: NodeInstance, inputName: string, enabled: boolean): void {
  const owner = node as unknown as { _runOnValueChange?: Record<string, boolean> };
  if (!owner._runOnValueChange) owner._runOnValueChange = {};
  owner._runOnValueChange[inputName] = enabled;
}

/**
 * Constraint 4, as a shared predicate.
 *
 * A node in this class publishes a *cached* result, and the cache has to start somewhere.
 * Starting it at `0` (Expression), `''` or `false` is what made "has not run yet"
 * indistinguishable from "ran and got that" — the NDA-004 class-B shape, a plausible value
 * rather than a visibly absent one. Every family in the class now starts its cache at `null`
 * and sets `_internal.hasEvaluated` on the first real evaluation; the result getters answer
 * `null` until then.
 *
 * This is deliberately *not* wired to the checkboxes. It is true of a node that has never
 * been asked to run for any reason — no `Run` pulse, no ticked input that ever moved.
 */
export function neverEvaluated(node: NodeInstance): boolean {
  return !node._internal.hasEvaluated;
}

/** Mark the node as having produced at least one real answer. See {@link neverEvaluated}. */
export function markEvaluated(node: NodeInstance): void {
  node._internal.hasEvaluated = true;
}
