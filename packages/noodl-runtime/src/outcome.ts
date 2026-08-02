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

import type { OutputPortDefinition } from '@noodl/types';

/** The three terminal outcomes. Exactly one per invocation. */
export type NodeOutcome = 'done' | 'unchanged' | 'failure';

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
