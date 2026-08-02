/**
 * The outcome contract's port set, declared once.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and phase 35 `ERG-001` for the
 * build. The emit side lives on `Node.prototype` (`node.ts`) so every runtime gets it; this file
 * is the *declaration* side, so that a node adopting the contract cannot spell a port name
 * differently from the helper that fires it.
 *
 * ⚠️ **Why one place matters here specifically.** Phase 30's clearest structural finding is that a
 * rule implemented per node diverges: `NDA-015` claimed to have de-duplicated a helper and had in
 * fact done 1 of 4 call sites (FINDINGS **F-i′**). The same divergence is already visible in the
 * thing this contract replaces — §0.2 found the eight ports that *display* as "Done" carrying
 * **four different internal names** (`modified`, `created`, `stored`, `done`), because eight nodes
 * each picked one.
 */

import type {
  InputPortDefinition,
  NodeInstance,
  OutcomeFailureOptions,
  OutcomeToken,
  OutputPortDefinition
} from '@noodl/types';

/** The three terminal outcomes. Exactly one per invocation. */
export type NodeOutcome = 'done' | 'unchanged' | 'failure';

/**
 * End every invocation in a coalesced batch with the same outcome.
 *
 * ERG-001 §4. Several actions defer their work through a `scheduleXxx` guard that drops the
 * *second* pulse in an update pass — which is deliberate and is how "set the fields, then press
 * Do" batches. It must not drop the second pulse's **outcome**: two invocations are two
 * invocations, and Rule 1 is about each of them.
 *
 * `foreach.tsx` established the shape (`pendingRefreshOutcomes` is an array for exactly this
 * reason) and the Cloud Services family needed it eight more times, so it is written once here
 * rather than eight times. The array is the caller's — drain it into a local before the async
 * work starts, so a second `Do` arriving mid-flight owns its own batch rather than being settled
 * by the first request's answer.
 */
export function reportOutcomes(
  node: NodeInstance,
  tokens: OutcomeToken[],
  outcome: NodeOutcome,
  options?: OutcomeFailureOptions
): void {
  for (const token of tokens) node.reportOutcome(token, outcome, options);
}

/** The universal completion signal, which every action emits after its outcome. */
export const COMPLETED_PORT = 'completed';

export interface OutcomePortOptions {
  /**
   * Omit when the action genuinely cannot fail. "A node that cannot fail gets no `Failure`
   * port" — NDA-004 established it and the contract keeps it; `Create New Array` builds its own
   * collection and has nothing to fail at.
   */
  failure?: string | false;
  /**
   * Omit when the action cannot legitimately no-op. Most actions always change something.
   */
  unchanged?: string | false;
  /** Overrides the `Done` description, which is otherwise generic. */
  done?: string;
  /** Port group. `Events` matches the rest of the library. */
  group?: string;
}

/**
 * The contract's outputs, ready to spread into a definition's `outputs`.
 *
 * Every port carries a `description` because `description` is canonical (Richard, 2026-08-01):
 * enrichment `ports` may only add what the source cannot know, and `tooltip` is display-only.
 */
export function outcomeOutputs(options: OutcomePortOptions = {}): Record<string, OutputPortDefinition> {
  const group = options.group || 'Events';
  const outputs: Record<string, OutputPortDefinition> = {
    done: {
      type: 'signal',
      displayName: 'Done',
      group,
      description: options.done || 'Fires when the action ran and changed something'
    },
    [COMPLETED_PORT]: {
      type: 'signal',
      displayName: 'Completed',
      group,
      description:
        'Fires after every invocation, whatever the outcome — wire this to carry on regardless. ' +
        'Failure still fires and still carries its reason, so this cannot hide an error'
    }
  };

  if (options.unchanged !== false && options.unchanged !== undefined) {
    outputs.unchanged = {
      type: 'signal',
      displayName: 'Unchanged',
      group,
      description: options.unchanged
    };
  }

  if (options.failure !== false && options.failure !== undefined) {
    outputs.failure = {
      type: 'signal',
      displayName: 'Failure',
      group,
      description: options.failure
    };
  }

  return outputs;
}

/**
 * ERG-001 §3 — the per-node escape hatch, and the contract's one sanctioned setting.
 *
 * ```
 * Treat Unchanged as:  Unchanged (default) | Done | Failure
 * ```
 *
 * Rule 3 is "prefer a port over a setting whenever both would work", and this is the one place
 * the contract says a setting *is* right: a project whose whole idiom is "a duplicate is a bug"
 * genuinely wants a different answer, and it is one option on one port rather than a panel of
 * signal-routing switches. It follows the shape NDA-003 already shipped as `Treat empty as` on
 * the Variables nodes, which is why it reads the same way in the panel.
 *
 * Rule 4 is not violated. That rule forbids a port's behaviour depending on whether a
 * *different port happens to be connected* — the `Expression`/`Run` defect. This is a declared,
 * visible, author-chosen mode, which Rule 4 explicitly allows: "where two modes are genuinely
 * needed, the mode is declared, visible and author-chosen".
 *
 * ⚠️ **The default must be correct without the setter ever running.** A declared `default` does
 * not run its setter — FINDINGS **A-D1**, where `Global Store`, `Subscribe to Store` and
 * `State History` did nothing at all until an author touched an input, while the property panel
 * displayed the default the whole time. So the value is stored under {@link TREAT_UNCHANGED_AS}
 * and read as "anything other than `done`/`failure` means `unchanged`", which is what
 * `undefined` lands on. {@link reportOutcome}'s remap is written that way round deliberately.
 *
 * ⚠️ **`Failure` is offered only when the node has a `Failure` port to route to.** The Variables
 * family is the spec's named first home and has no `failure` — "a node that cannot fail gets no
 * `Failure` port" — so an unconditional three-option enum would have let an author select an
 * outcome with nowhere to land, and `reportOutcome` would answer with `outcome/missing-port`
 * against a graph the author configured through the panel. The options are derived from the
 * same `options` object that built the outputs, so the two cannot disagree.
 *
 * Spread into a definition's `inputs` alongside {@link outcomeOutputs} in its `outputs`. Pass
 * the *same* options object to both.
 */
export function outcomeInputs(options: OutcomePortOptions = {}): Record<string, InputPortDefinition> {
  // No `Unchanged` port means no `Unchanged` to reinterpret. Most actions always change
  // something, and adding a dead setting to them is exactly the test-surface multiplication
  // Rule 3's first warning is about.
  if (options.unchanged === false || options.unchanged === undefined) return {};

  const hasFailure = options.failure !== false && options.failure !== undefined;

  const enums = [
    { label: 'Unchanged', value: 'unchanged' },
    { label: 'Done', value: 'done' }
  ];
  if (hasFailure) enums.push({ label: 'Failure', value: 'failure' });

  return {
    [TREAT_UNCHANGED_AS_PORT]: {
      type: { name: 'enum', enums, allowEditOnly: true },
      displayName: 'Treat Unchanged as',
      group: 'Advanced',
      default: 'unchanged',
      description:
        'What this node reports when the action was valid and there was nothing to do. ' +
        'Unchanged (the default) keeps it a third outcome of its own. Done suits a project ' +
        'whose chains should carry on either way' +
        (hasFailure ? '; Failure suits one whose idiom is that a no-op is a bug' : '') +
        '. Completed fires whatever this is set to.',
      // `allowEditOnly` for the reason `Run Tasks` gives for its template contract: a
      // connection changing what an outcome *means* while the graph runs has no reading that
      // helps anyone.
      set: function (this: NodeInstance, value: unknown) {
        (this._internal as Record<string, unknown>)[TREAT_UNCHANGED_AS] = value;
      }
    } as InputPortDefinition
  };
}

/** The input port's name. */
export const TREAT_UNCHANGED_AS_PORT = 'treatUnchangedAs';

/**
 * Where {@link outcomeInputs}' setter parks the policy, and where {@link reportOutcome} reads
 * it. Underscored so it cannot collide with a node's own `_internal` bookkeeping.
 */
export const TREAT_UNCHANGED_AS = '_treatUnchangedAs';
