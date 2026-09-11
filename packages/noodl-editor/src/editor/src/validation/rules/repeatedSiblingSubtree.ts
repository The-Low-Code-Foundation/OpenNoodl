/**
 * Rule: a subtree repeated among siblings wanted to be a component.
 *
 * The decomposition doctrine already says this in prose — *"Repetition is data.
 * Two or more structurally identical siblings become one component driven by a
 * Repeater over a data source. Never duplicate a subtree by hand."* — and it
 * shipped to both clients months before this rule existed. It was still ignored,
 * including by the reference build this rule came out of: `Pages/Home` reached
 * **66 nodes**, of which three identical trust items, three identical section
 * heads and three identical category cards were hand-duplicated subtrees.
 *
 * That is the case for a rule rather than more prose. A doctrine with no check
 * behind it is advice, and the one thing every agent does with advice under
 * pressure is skip it. This is the same conclusion phase 39 reached: write the
 * gate, not the fix list.
 *
 * ## What counts as identical
 *
 * A **structural signature**: the node's type plus its children's signatures,
 * recursively. Deliberately NOT parameters — the whole point of factoring is
 * that the instances differ in their values and agree in their shape, so
 * comparing values would only ever fire on true copy-paste and would miss
 * exactly the case worth reporting.
 *
 * ## Why the threshold is three, not two
 *
 * Two siblings of the same shape is a pair — a label beside a value, two buttons
 * in a row — and factoring a pair usually costs more than it saves. Three is the
 * point at which a fourth is likely, and at which the duplication starts to
 * decide how the page is maintained. `decomposition.ts` says "two or more" for
 * the human reading it; this rule is deliberately more conservative than the
 * doctrine it enforces, because a false positive here teaches an agent to
 * distrust the whole diagnostic set.
 *
 * Single-node repeats are ignored entirely: four sibling `Text` nodes are a
 * list, not a duplicated component, and a rule that flags them fires on almost
 * every real graph.
 *
 * A **warning**, never an error: the graph is correct and renders, and the
 * repair is a refactor across components rather than a local edit.
 *
 * @module noodl-editor/validation/rules/repeatedSiblingSubtree
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormNode } from '../model';
import { Rule, RuleContext } from './types';

/** Minimum sibling copies before this is worth reporting. See the header. */
const REPEAT_THRESHOLD = 3;
/** A repeated subtree smaller than this is a list item, not a component. Three,
 * not two: the doctrine itself says a two-node group is "a file and a hop that
 * bought nothing", and at 2 the rule fired on icon+label pairs across the corpus. */
const MIN_SUBTREE_NODES = 3;

interface Shape {
  signature: string;
  size: number;
}

/**
 * Structural signature of a subtree: types and arrangement, never values.
 *
 * Memoised per component because a wide page walks the same subtrees once per
 * parent otherwise, and a page graph is the thing this rule runs on most.
 */
function shapeOf(node: NormNode, nodeById: Map<string, NormNode>, memo: Map<string, Shape>): Shape {
  const cached = memo.get(node.id);
  if (cached) return cached;

  const children = node.children.map((id) => nodeById.get(id)).filter((n): n is NormNode => !!n);
  const childShapes = children.map((c) => shapeOf(c, nodeById, memo));
  const shape: Shape = {
    signature: `${node.type}(${childShapes.map((s) => s.signature).join(',')})`,
    size: 1 + childShapes.reduce((a, s) => a + s.size, 0)
  };
  memo.set(node.id, shape);
  return shape;
}

export const repeatedSiblingSubtree: Rule = {
  code: DiagnosticCode.RepeatedSiblingSubtree,
  description: 'Structurally identical sibling subtrees should be one component, instantiated or repeated.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component, nodeById } of ctx.components) {
      const memo = new Map<string, Shape>();

      // Roots are siblings of each other too, but only visual roots — a page's
      // logic nodes sit at top level and are not a layout repetition.
      const parents: Array<{ id: string | undefined; childIds: string[] }> = [
        ...component.nodes.filter((n) => n.children.length > 0).map((n) => ({ id: n.id, childIds: n.children }))
      ];

      for (const parent of parents) {
        const groups = new Map<string, { ids: string[]; size: number; type: string }>();

        for (const childId of parent.childIds) {
          const child = nodeById.get(childId);
          if (!child) continue;
          const shape = shapeOf(child, nodeById, memo);
          if (shape.size < MIN_SUBTREE_NODES) continue;
          const g = groups.get(shape.signature);
          if (g) g.ids.push(childId);
          else groups.set(shape.signature, { ids: [childId], size: shape.size, type: child.type });
        }

        for (const [, group] of groups) {
          if (group.ids.length < REPEAT_THRESHOLD) continue;
          const parentNode = parent.id ? nodeById.get(parent.id) : undefined;
          out.push({
            code: DiagnosticCode.RepeatedSiblingSubtree,
            severity: 'warning',
            message:
              `${group.ids.length} sibling subtrees here are structurally identical ` +
              `(${group.size} nodes each, rooted at ${group.type}). Make one component and instantiate it ` +
              `${group.ids.length} times — or drive a Repeater from a data source if the copies differ only in their values.`,
            location: {
              component: component.name,
              nodeId: group.ids[0],
              nodeType: group.type,
              nodeLabel: parentNode?.label
            }
          });
        }
      }
    }

    return out;
  }
};
