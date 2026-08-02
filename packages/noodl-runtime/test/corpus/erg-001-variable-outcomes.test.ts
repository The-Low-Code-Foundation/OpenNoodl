/**
 * ERG-001 §4 — the outcome contract on the Variables family.
 *
 * Four nodes, one base (`variables/variablebase.ts`), one action: `Set`. §0.3 names this shape
 * as the canonical `Unchanged` — storing the value a Variable already holds — and the node has
 * *already computed the answer* since NDA-002 §3, in `setValueTo`'s `changed` guard. It simply
 * threw it away: `setValueTo` returned `void` and `Set` fired `stored` unconditionally.
 *
 * ## ⚠️ `Stored` is removed, not renamed, and it is the first port whose meaning is exactly
 * `Completed`
 *
 * §0.2 Result 3 found the opposite case twice — `Completed` on `GlobalStore.Set` and
 * `ActionDispatcher` meant "succeeded", so adopting the reserved name in place would have
 * inverted a wire an author had already drawn. `Stored` here is the mirror image: it fires
 * after every `Set` whatever happened, which is precisely what the contract's `Completed`
 * promises. Keeping both would have shipped two ports that always fire together, which is the
 * per-node divergence `outcome.ts` exists to prevent; renaming it to `done` would have been a
 * lie, because `done` must mean "changed something" and `Stored` fired when nothing changed.
 *
 * The two-sided sweep found no wire to `stored` on any of these four in the repo. The four hits
 * are on the **deprecated `Variable` node** (a different type) inside 2020 merge-algorithm
 * golden fixtures, which are not live graphs and must not be edited.
 *
 * ## ⚠️ `Changed` stays, and is not the outcome
 *
 * `Changed` fires from `setValueTo` however it was reached — including the run-on-value-change
 * path, where `Value` writes straight through with no `Set` involved. It is a value-level
 * event, the same relationship `Items Rendered` has to the Repeater's `Refresh`. Only
 * `saveValue` mints a token, so a Variable driven purely by `Value` reports no outcome at all.
 *
 * ## No `Failure`
 *
 * `setValueTo` cannot refuse. `undefined` abstains, and `variablebase` documents that path as
 * unreachable from `Set` (`latestValue` is seeded `0`); every other value casts, and a cast
 * that yields `NaN` is stored as the `Treat empty as` value rather than rejected. A node that
 * cannot fail gets no `Failure` port.
 *
 * ## What reverting reddens — predicted before running
 *
 * Every row runs three times (`describe.each` over String / Number / Boolean), so a prediction
 * of "one row" is three failures.
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Set` reporting `done` unconditionally | **9** — the same-value row, the default-config row and the three-Sets row, ×3. The first-Set control stays green |
 * | `setValueTo` ignoring `hasBeenSet` (NDA-002 §3) | **3** — the start-value row only; every other row stores a value genuinely different from the start |
 * | the token *moved* from `Set` into `setValueTo` | **6** — the Value-only row and the default-config row, ×3. The four staged rows untick `Value`, so `setValueTo` is only ever reached from `Set` in them |
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createNode, pulse, type DrivenNode } from '../helpers/node-harness';

import BooleanModule = require('../../src/nodes/std-library/variables/boolean');
import NumberModule = require('../../src/nodes/std-library/variables/number');
import StringModule = require('../../src/nodes/std-library/variables/string');

/** The three concrete Variables that live in this package. Color is built in the viewer. */
const FAMILY: Array<{ type: string; module: unknown; startValue: unknown; a: unknown; b: unknown }> = [
  { type: 'String', module: StringModule, startValue: '', a: 'hello', b: 'goodbye' },
  { type: 'Number', module: NumberModule, startValue: 0, a: 7, b: 9 },
  { type: 'Boolean', module: BooleanModule, startValue: false, a: true, b: false }
];

function variable(entry: (typeof FAMILY)[number]): DrivenNode {
  return createNode(entry.module as never, entry.type, `erg001-${entry.type}`);
}

function outcomesOf(signals: string[]): string[] {
  return signals.filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(signals: string[], name: string): number {
  return signals.filter((s) => s === name).length;
}

/**
 * A Variable configured the way an author who wants `Set` to mean something configures it:
 * `Value` unticked under Run On Value Change, so an arriving value parks until `Set` fires.
 *
 * ⚠️ Through the real port, not `_internal`. NDA-017 §2 made `Set` purely *additive* — wiring
 * it no longer stops `Value` writing through — so with the default (every input ticked) a
 * `Set` after a `Value` can only ever report `Unchanged`. That is measured as its own row
 * below rather than designed around.
 */
function staged(entry: (typeof FAMILY)[number]): DrivenNode {
  const v = variable(entry);
  v.node.setInputValue('runOnChange-value', false);
  return v;
}

/** Parks a value behind `Set` on a node built by {@link staged}. */
function stage(v: DrivenNode, value: unknown): void {
  v.node.setInputValue('value', value);
}

describe.each(FAMILY)('ERG-001 §4: $type Variable', (entry) => {
  it('publishes Done, Unchanged and Completed — and no Failure, because a store cannot fail', () => {
    const v = variable(entry);

    expect(v.node.hasOutput('done')).toBe(true);
    expect(v.node.hasOutput('unchanged')).toBe(true);
    expect(v.node.hasOutput('completed')).toBe(true);
    // (pinned control) `setValueTo` casts or substitutes; it never refuses.
    expect(v.node.hasOutput('failure')).toBe(false);

    // `Stored` is gone, and its meaning is exactly `Completed`. The rename cannot pass
    // vacuously: the old wire name must be *absent*, not merely unasserted.
    expect(v.node.hasOutput('stored')).toBe(false);
    // `Changed` stays — it is a value-level event, not this invocation's outcome.
    expect(v.node.hasOutput('changed')).toBe(true);
  });

  it('reports Done when Set stores a value the Variable did not hold', () => {
    const v = staged(entry);
    stage(v, entry.a);

    pulse(v.node, 'saveValue');
    v.node.update();

    expect(v.out('savedValue')).toBe(entry.a);
    expect(outcomesOf(v.signals)).toEqual(['done']);
    expect(countOf(v.signals, 'completed')).toBe(1);
    expect(v.signals.indexOf('completed')).toBeGreaterThan(v.signals.indexOf('done'));
    // Values before the signal: a graph wiring `Done -> read Value` must see the new one.
    expect(v.signals.indexOf('changed')).toBeLessThan(v.signals.indexOf('done'));
  });

  it('reports Unchanged when Set stores the value it already holds', () => {
    const v = staged(entry);
    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();

    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();

    // §0.3's canonical case, and the node had already computed the answer since NDA-002 §3 —
    // `setValueTo`'s `changed` guard — and thrown it away.
    expect(outcomesOf(v.signals)).toEqual(['done', 'unchanged']);
    expect(countOf(v.signals, 'completed')).toBe(2);
    // `Changed` did not fire a second time, which is the behaviour `Unchanged` now names.
    expect(countOf(v.signals, 'changed')).toBe(1);
  });

  it('reports Done for the very first Set even when it stores the start value', () => {
    const v = staged(entry);
    stage(v, entry.startValue);

    pulse(v.node, 'saveValue');
    v.node.update();

    // NDA-002 §3 / corpus R7: a seeded `startValue` was never observed by the author, so the
    // first store is a real change. Folding this into `Unchanged` would resurrect R7 on a new
    // port — "set this String to '', then react" silent for ever.
    expect(outcomesOf(v.signals)).toEqual(['done']);
  });

  it('reports nothing when Value writes straight through, with no Set involved', () => {
    const v = variable(entry);

    v.node.setInputValue('value', entry.a);
    v.node.setInputValue('value', entry.b);
    v.node.update();

    // The mount-path rule. `Changed` is free to fire — it is the value-level event and means
    // something else — but no invocation happened, so no outcome and no Completed.
    expect(v.signals).toContain('changed');
    expect(outcomesOf(v.signals)).toEqual([]);
    expect(v.signals).not.toContain('completed');
  });

  it('reports Unchanged for a Set after a Value that already wrote through — the default config', () => {
    const v = variable(entry);

    // Every input ticked is the default (absent reads as ticked — FINDINGS A-D1 is why it
    // cannot be a declared `default`). NDA-017 §2 made `Set` additive, so `Value` has already
    // stored by the time `Set` fires and there is genuinely nothing left to do.
    v.node.setInputValue('value', entry.a);
    v.node.update();
    pulse(v.node, 'saveValue');
    v.node.update();

    expect(outcomesOf(v.signals)).toEqual(['unchanged']);
    expect(countOf(v.signals, 'completed')).toBe(1);
  });

  it('gives three Sets three outcomes and three Completeds', () => {
    const v = staged(entry);

    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();
    for (let i = 0; i < 2; i++) {
      stage(v, entry.a);
      pulse(v.node, 'saveValue');
      v.node.update();
    }

    // NV-iii: per-invocation, never latched on the node.
    expect(outcomesOf(v.signals)).toEqual(['done', 'unchanged', 'unchanged']);
    expect(countOf(v.signals, 'completed')).toBe(3);
  });

  // ── ERG-001 §3 — `Treat Unchanged as` ───────────────────────────────────────
  //
  // The contract's one sanctioned setting, on the family the spec names as its first home.
  // Rule 3 is "prefer a port over a setting whenever both would work"; this is the case where
  // a setting *is* right, because a project whose whole idiom is "a duplicate is a bug"
  // genuinely wants a different answer and it is one option on one port.

  it('§3 (the A-D1 trap): defaults to Unchanged with the setter never having run', () => {
    const v = staged(entry);

    // ⚠️ **The port is deliberately not touched.** A declared `default` does not run its
    // setter — FINDINGS **A-D1**, where `Global Store`, `Subscribe to Store` and `State
    // History` did nothing at all until an author touched an input while the panel displayed
    // the default the whole time. So `_treatUnchangedAs` is `undefined` here, and the remap in
    // `reportOutcome` is written as "only 'done'/'failure' remap" precisely so that
    // `undefined` lands on the default without anything having to run.
    expect(v.node.hasInput('treatUnchangedAs')).toBe(true);

    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();
    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();

    expect(outcomesOf(v.signals)).toEqual(['done', 'unchanged']);
  });

  it('§3: set to Done, a no-op Set reports Done instead', () => {
    const v = staged(entry);
    v.node.setInputValue('treatUnchangedAs', 'done');

    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();
    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();

    // The escape hatch for a project whose chains should carry on either way. `Unchanged` is
    // not sent at all — "exactly one" is still the load-bearing half of Rule 1.
    expect(outcomesOf(v.signals)).toEqual(['done', 'done']);
    expect(countOf(v.signals, 'unchanged')).toBe(0);
    // ⚠️ And `Changed` still did not fire, because nothing changed. The setting reinterprets
    // the *outcome*; it does not make a value-level event lie.
    expect(countOf(v.signals, 'changed')).toBe(1);
  });

  it('§3: Completed fires whatever the setting is', () => {
    const v = staged(entry);
    v.node.setInputValue('treatUnchangedAs', 'done');

    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();
    stage(v, entry.a);
    pulse(v.node, 'saveValue');
    v.node.update();

    // The one port with no exemption, and the reason an author can rely on it: it is the
    // wire that does not change meaning when somebody edits this setting.
    expect(countOf(v.signals, 'completed')).toBe(2);
  });

  /**
   * ⚠️ **Two options, not three, and derived rather than authored.**
   *
   * This node has no `Failure` port — "a node that cannot fail gets no `Failure` port" — so
   * offering `Failure` would let an author select, through the property panel, an outcome with
   * nowhere to land; `reportOutcome` would then answer `outcome/missing-port` against a graph
   * they configured legitimately. `outcomeInputs` derives the enum from the same options object
   * that builds the outputs, so the two cannot disagree.
   *
   * ⚠️ Asserted on the **authored definition**, not the instance: `getInput` returns only the
   * registered setter, so an instance cannot be asked what an enum's options are. The
   * definition is the surface the property panel and the catalog generator both read.
   */
  it('§3: does not offer Failure on a node that has no Failure port', () => {
    const definition = (entry.module as { node: { inputs: Record<string, { type: unknown }> } }).node;
    const type = definition.inputs.treatUnchangedAs.type as { enums: Array<{ value: string }> };

    expect(type.enums.map((e) => e.value)).toEqual(['unchanged', 'done']);
    expect(staged(entry).node.hasOutput('failure')).toBe(false);
  });
});
