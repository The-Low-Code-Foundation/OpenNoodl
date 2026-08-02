/**
 * Rule: a chain sequenced from `Done` stops dead when the action was a no-op.
 *
 * ERG-001 §5, and success criterion 6 of the Outcome Contract. This is the machine-detectable
 * form of the sentence the whole contract was written from:
 *
 * > some workflows are wired up as a series of input and output signals, and the workflow
 * > breaks at the point that one of the nodes doesn't output anything because of a duplicate
 * > you didn't plan for, where you'd actually like it to carry on running regardless.
 *
 * Before the contract that defect was in the *runtime*: the duplicate path emitted nothing at
 * all. §4 closed that — every path through every action now emits. What survives is an
 * **authoring** defect with exactly the same consequence: an author wires `Done`, the action
 * legitimately no-ops, `Unchanged` fires instead, and the chain stops. `Completed` exists
 * precisely so it does not have to, and it is invisible until someone wires it.
 *
 * So the rule fires on one shape — the author **enumerating outcomes and missing one**:
 *
 * - the node declares `unchanged` (so it *can* legitimately no-op),
 * - something invokes it through a signal input,
 * - **both** `done` and `failure` carry wires,
 * - and neither `unchanged` nor `completed` does.
 *
 * ## ⚠️ Two wider predicates were written first, and both were measured and rejected
 *
 * Recorded because the measurements are the argument for this shape, and re-deriving them
 * costs an afternoon:
 *
 * | Predicate | Firings across the 50 shipped examples | True positives |
 * |---|---|---|
 * | Every outcome unwired, chain continues from some other signal | 7 | **0** |
 * | `done` wired, `unchanged`/`completed` not | 6 | ~1 |
 * | `done` **and** `failure` wired, `unchanged`/`completed` not | 1 | **1** |
 *
 * The first failed structurally rather than for want of tuning: almost every action also
 * publishes *announcements* — `Applied`, `On Message`, `On Stop`, `On True`, `Timer Finished`
 * — and an announcement is very often the **better** thing to sequence from, being more
 * specific than the generic outcome. Wiring `Optimistic Update`'s `Applied` to the request is
 * not a mistake; sending the request when the apply *failed* would be.
 *
 * The second failed for a subtler reason worth keeping: `Unchanged` very often means *the user
 * cancelled* — an `Open File Picker` they dismissed, an HTTP request they abandoned — and
 * **not** continuing is then exactly right. "Did the author want to carry on through the
 * no-op?" is genuinely not derivable from a graph where both answers are common and correct.
 *
 * Requiring `failure` as well is what makes intent readable. An author who has wired two
 * different outcomes to two different places is demonstrably enumerating them, so the third is
 * a gap in what they built rather than a shape they chose. A rule that flags correct work is
 * worse than no rule, because authors learn to ignore it — `orphanedNode` records the same
 * principle for the same reason.
 *
 * @module noodl-editor/validation/rules/unwiredOutcome
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

/**
 * The contract's port names.
 *
 * Spelled here rather than imported from `noodl-runtime`'s `outcome.ts` because the editor's
 * validation layer does not depend on the runtime — the same reason `CatalogIndex` derives
 * everything else it knows from the generated catalog.
 */
const DONE_PORT = 'done';
const FAILURE_PORT = 'failure';
const UNCHANGED_PORT = 'unchanged';
const COMPLETED_PORT = 'completed';

export const unwiredOutcome: Rule = {
  code: DiagnosticCode.UnwiredOutcome,
  description: 'A chain sequenced from Done has no route for the action that legitimately did nothing.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component } of ctx.components) {
      const drivenInputs = new Map<string, Set<string>>();
      const wiredOutputs = new Map<string, Set<string>>();

      for (const connection of component.connections) {
        const into = drivenInputs.get(connection.toId) || new Set<string>();
        into.add(connection.toProperty);
        drivenInputs.set(connection.toId, into);

        const outOf = wiredOutputs.get(connection.fromId) || new Set<string>();
        outOf.add(connection.fromProperty);
        wiredOutputs.set(connection.fromId, outOf);
      }

      for (const node of component.nodes) {
        // The node must be able to no-op at all. "A node that cannot be a no-op gets no
        // `Unchanged` port" is the contract's own exemption, and this is where it is honoured:
        // `Page Stack`'s missing `Unchanged` and `State History`'s missing `Failure` are
        // deliberate, and neither can reach this rule.
        if (!ctx.catalog.hasPort(node.type, 'output', UNCHANGED_PORT)) continue;
        if (!ctx.catalog.hasPort(node.type, 'output', COMPLETED_PORT)) continue;

        // Something must invoke it. An action nobody triggers is not a broken chain, and one
        // driven only by a value change is not being sequenced.
        const signalInputs = ctx.catalog.signalInputNames(node.type);
        const driven = drivenInputs.get(node.id);
        if (!driven || !signalInputs.some((name) => driven.has(name))) continue;

        // ⚠️ **Both**, and the second one is what makes the rule usable. An author who has
        // routed two different outcomes to two different places is demonstrably enumerating
        // them, so a missing third is a gap. `done` alone is not enough: it is very often
        // correct to stop on a no-op, because a no-op frequently means the user cancelled.
        const wired = wiredOutputs.get(node.id);
        if (!wired || !wired.has(DONE_PORT) || !wired.has(FAILURE_PORT)) continue;

        if (wired.has(UNCHANGED_PORT) || wired.has(COMPLETED_PORT)) continue;

        out.push({
          code: DiagnosticCode.UnwiredOutcome,
          severity: 'warning',
          message:
            'This node routes "done" and "failure" to different places but has no route for ' +
            '"unchanged" — the action running successfully and legitimately doing nothing, ' +
            'such as a duplicate, a delete of what was already gone, or a request that was ' +
            'cancelled. That path reaches neither branch and the chain stops here. Wire ' +
            '"unchanged" to handle the no-op, or "completed" to carry on regardless.',
          location: {
            component: component.name,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label
          },
          suggestion: `${node.type}.completed`,
          alternatives: [COMPLETED_PORT, UNCHANGED_PORT]
        });
      }
    }

    return out;
  }
};
