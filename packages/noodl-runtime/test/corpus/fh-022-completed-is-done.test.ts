/**
 * FH-022 — when `Completed` is `Done`, the port says so.
 *
 * Out of TALK-006 decision 1 (had 2026-08-05). On the nodes that declare neither `Unchanged`
 * nor `Failure`, `Done` and `Completed` fire on the same path every time with nothing between
 * them. Richard hit it on `Condition` and read two identically-behaving ports as the vocabulary
 * doubling up. **Both ports stay and neither is renamed** — the value of `Completed` is that
 * wiring it is never a per-node decision — so what changes is the words.
 *
 * ## ⚠️ Where the rule had to live, and why it is not where FH-022 said
 *
 * The task specified one branch inside `outcomeOutputs`, derived from its own `OutcomePortOptions`
 * "so the wording and the port set cannot disagree". Measured: they already disagree, on **four**
 * nodes. `expression.ts`, `modelcrudbase.ts`'s `addFailure` mixin, `componentutils/base.ts`'s
 * `canFailToResolve` and `variablenode2.ts` each declare `failure` **beside** the helper rather
 * than through it, so `outcomeOutputs` sees no `failure` option on nodes that have a `Failure`
 * port — and three of those really do report a `failure` outcome. An options-derived branch
 * printed "it always fires together with Done" on `Expression`, `Set Object Properties`,
 * `Variable` and `Set Parent Component Object Properties`, where it is false.
 *
 * So the rule reads the **assembled outputs**, in `defineNode`, which cannot disagree with the
 * port set because it is the port set. FH022-2 is the row that would have caught the specified
 * version, and it is written against the four names for exactly that reason — they are evidence
 * of a measured divergence, not a hardcoded population.
 *
 * ## ⚠️ These rows pin the rule, not a list of eight node names
 *
 * The set of affected nodes is a **consequence** of the contract: a node that gains a `Failure`
 * port must lose the sentence with no edit anywhere, and a test holding a list of eight type
 * names would be stale from that moment and would then be *defending* the staleness. So the rule
 * is asserted against port sets in FH022-1, and the population it lands on is **derived from the
 * generated catalog** in FH022-3 rather than enumerated.
 *
 * FH022-3 is therefore also a staleness check on `node-catalog.json`: a catalog generated before
 * this change disagrees with the source it claims to describe, which is what `catalog:check` is
 * for and the failure mode a generator fix has produced here before.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the narrowing call in `defineNode` | FH022-1's sole-outcome row and FH022-3 |
 * | deriving from `OutcomePortOptions` instead of the outputs | FH022-2, and only FH022-2 |
 * | appending to the generic text instead of replacing it | FH022-1's "does not claim Failure fires" clause |
 * | dropping the exact-sentence guard | FH022-1's hand-rolled-`completed` row |
 */

/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

import type { NodeDefinitionOptions, OutputPortDefinition } from '@noodl/types';

import { COMPLETED_PORT, COMPLETED_SOLE_OUTCOME, COMPLETED_WITH_OTHER_OUTCOMES, outcomeOutputs } from '../../src/outcome';

import NodeDefinition = require('../../src/nodedefinition');

/** Runs a definition through `defineNode` and hands back the `Completed` description it ends with. */
function completedAfterDefine(outputs: Record<string, OutputPortDefinition>, name = 'test.Outcome'): string {
  const definition = NodeDefinition.defineNode({
    name,
    category: 'Test',
    outputs
  } as NodeDefinitionOptions);
  return definition.metadata.outputs[COMPLETED_PORT].description as string;
}

// ---------------------------------------------------------------------------
// FH022-1 — the rule, stated against the port set.
// ---------------------------------------------------------------------------

describe('FH022-1 — the wording follows the port set', () => {
  it('says there is no other outcome when neither Unchanged nor Failure is on the node', () => {
    const description = completedAfterDefine(
      outcomeOutputs({ done: 'Fires when the condition was evaluated' }),
      'test.SoleOutcome'
    );

    expect(description).toBe(COMPLETED_SOLE_OUTCOME);
    expect(description).toContain('no other outcome');
    expect(description).toContain('together with Done');
    // Replaced, not appended: "Failure still fires" is untrue of a node with no Failure port,
    // and leaving it beside the new sentence would be a second wrong statement, not a fix.
    expect(description).not.toContain('Failure still fires');
  });

  it('keeps the generic wording byte-identical when a Failure port exists', () => {
    expect(completedAfterDefine(outcomeOutputs({ failure: 'Refused' }), 'test.WithFailure')).toBe(
      COMPLETED_WITH_OTHER_OUTCOMES
    );
  });

  it('keeps the generic wording byte-identical when only an Unchanged port exists', () => {
    expect(completedAfterDefine(outcomeOutputs({ unchanged: 'Nothing to do' }), 'test.WithUnchanged')).toBe(
      COMPLETED_WITH_OTHER_OUTCOMES
    );
  });

  it('leaves a hand-rolled `completed` alone, whatever its port set', () => {
    // `GlobalStore.Set` and `ActionDispatcher` both shipped a port called `Completed` that fired
    // only on success — a different meaning under a reserved name (ERG-001 §0.2 Result 3). The
    // guard is the exact generic sentence, so a node that never adopted the contract is not
    // described by it.
    const own = 'Fires when the store was written';
    expect(completedAfterDefine({ [COMPLETED_PORT]: { type: 'signal', description: own } }, 'test.OwnPort')).toBe(own);
  });

  it('is idempotent, because defineNode runs twice on the same module object', () => {
    const outputs = outcomeOutputs({ done: 'Fires when it ran' });
    completedAfterDefine(outputs, 'test.Twice1');
    expect(completedAfterDefine(outputs, 'test.Twice2')).toBe(COMPLETED_SOLE_OUTCOME);
  });
});

// ---------------------------------------------------------------------------
// FH022-2 — the four nodes that declare Failure beside the helper.
// ---------------------------------------------------------------------------

describe('FH022-2 — a Failure port declared outside outcomeOutputs still counts', () => {
  it('keeps the generic wording, which deriving from OutcomePortOptions would not have', () => {
    // The shape of all four: the contract's outputs spread in with no `failure` option, and a
    // `failure` port added beside them by a mixin, a base or by hand. `outcomeOutputs` alone
    // cannot see the second half; `defineNode` sees the whole node.
    const outputs = {
      ...outcomeOutputs({ done: 'Fires once the properties have been written' }),
      failure: {
        type: 'signal' as const,
        displayName: 'Failure',
        group: 'Events',
        description: 'Fires when there was no object to act on'
      }
    };

    expect(outputs[COMPLETED_PORT].description).toBe(COMPLETED_WITH_OTHER_OUTCOMES);
    expect(completedAfterDefine(outputs, 'test.FailureBeside')).toBe(COMPLETED_WITH_OTHER_OUTCOMES);
  });
});

// ---------------------------------------------------------------------------
// FH022-3 — the population, derived.
// ---------------------------------------------------------------------------

interface CatalogPort {
  name: string;
  description?: string;
}
interface CatalogNode {
  typeName: string;
  outputs?: CatalogPort[];
}

describe('FH022-3 — every node in the catalog obeys the rule', () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../noodl-types/src/node-catalog.json'), 'utf8')
  ) as { nodes: CatalogNode[] };

  const withCompleted = catalog.nodes.filter((n) => (n.outputs || []).some((o) => o.name === COMPLETED_PORT));

  it('finds the outcome contract across the whole library, so the rows below are not vacuous', () => {
    expect(withCompleted.length).toBeGreaterThan(50);
  });

  it('gives the sole-outcome nodes the new sentence and everyone else the generic one', () => {
    const wrong: string[] = [];

    for (const node of withCompleted) {
      const names = new Set((node.outputs || []).map((o) => o.name));
      const soleOutcome = !names.has('unchanged') && !names.has('failure');
      const description = (node.outputs || []).find((o) => o.name === COMPLETED_PORT)?.description;
      const expected = soleOutcome ? COMPLETED_SOLE_OUTCOME : COMPLETED_WITH_OTHER_OUTCOMES;

      if (description !== expected) wrong.push(node.typeName);
    }

    expect(wrong).toEqual([]);
  });

  it('the sole-outcome set is non-empty and every member really reports Done', () => {
    const soleOutcome = withCompleted.filter((n) => {
      const names = new Set((n.outputs || []).map((o) => o.name));
      return !names.has('unchanged') && !names.has('failure');
    });

    // Deliberately not asserted as `8`. The count is a consequence of the library, and pinning
    // it would turn "a node gained a Failure port" — a correctness improvement — into a red row
    // in a file that has nothing to say about that node.
    expect(soleOutcome.length).toBeGreaterThan(0);

    for (const node of soleOutcome) {
      expect((node.outputs || []).some((o) => o.name === 'done')).toBe(true);
    }
  });
});
