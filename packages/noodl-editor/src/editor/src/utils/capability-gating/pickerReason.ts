/**
 * The node picker's half of the gate — BCN-010.
 *
 * A separate entry point from `nodeWarning.ts` because the two answer different
 * questions and the difference is deliberate:
 *
 * | | Question | Backend |
 * |---|---|---|
 * | `nodeWarning` | "the node I placed — can this backend run it?" | the node's own `backendId`, when it has one |
 * | `pickerCapabilityReason` | "if I place this, will it work?" | the project's active backend, because an unplaced node has no `backendId` yet |
 *
 * Conflating them would have made the picker resolve every row against a
 * parameter that does not exist, which resolves to the project default anyway —
 * right answer, by accident, and wrong the moment a node gains a picker default.
 */

import { gateForNode, gateSentence, resolveGateTarget } from './index';

/**
 * Why the project's backend cannot serve this node type, or `undefined`.
 *
 * Called once per row per re-rank. Kept cheap: the descriptor lookup is a frozen
 * object read and `resolveGateTarget` reads two metadata keys, so the cost is a
 * couple of property accesses per card rather than anything worth memoising —
 * and memoising it would be wrong, since the answer changes when the user
 * switches backend with the picker open.
 */
export function pickerCapabilityReason(typeName: string): string | undefined {
  try {
    const target = resolveGateTarget(undefined);
    if (!target.type) return undefined;

    const gate = gateForNode(typeName, target);
    // `degraded` is not surfaced in the picker. The node works; the caveat
    // belongs where the user can act on it (the property panel and the canvas
    // hover), not on a row whose only job is "does this exist".
    if (!gate || gate.isUsable) return undefined;

    return gateSentence(gate, target);
  } catch (e) {
    // The picker must open whatever the project metadata looks like.
    return undefined;
  }
}
