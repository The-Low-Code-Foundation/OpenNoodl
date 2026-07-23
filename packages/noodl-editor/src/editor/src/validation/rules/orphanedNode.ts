/**
 * Rule: parent/child links are intact.
 *
 * The visual hierarchy is expressed by `node.parent` (id) and `node.children`
 * (ids). A link pointing at a node that does not exist leaves a node orphaned —
 * the graph structure requires parentage that isn't there. Both directions are
 * checked; both are `error` (pure integrity, catalog-independent). The corpus is
 * clean, so a firing is a real structural break (e.g. a container deleted while
 * its children kept pointing at it).
 *
 * We intentionally do NOT flag "a visual node with no parent" — legitimate
 * canvas roots have no parent, and distinguishing them from true orphans is a
 * source of false positives, which this task treats as the primary risk.
 *
 * @module noodl-editor/validation/rules/orphanedNode
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

export const orphanedNode: Rule = {
  code: DiagnosticCode.OrphanedNode,
  description: 'Parent and child node references point at nodes that exist.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const { component, nodeById } of ctx.components) {
      for (const node of component.nodes) {
        if (node.parent !== undefined && !nodeById.has(node.parent)) {
          out.push({
            code: DiagnosticCode.OrphanedNode,
            severity: 'error',
            message: `Node references parent "${node.parent}", which does not exist in this component.`,
            location: {
              component: component.name,
              nodeId: node.id,
              nodeType: node.type,
              nodeLabel: node.label
            }
          });
        }
        for (const childId of node.children) {
          if (!nodeById.has(childId)) {
            out.push({
              code: DiagnosticCode.OrphanedNode,
              severity: 'error',
              message: `Node lists child "${childId}", which does not exist in this component.`,
              location: {
                component: component.name,
                nodeId: node.id,
                nodeType: node.type,
                nodeLabel: node.label
              }
            });
          }
        }
      }
    }
    return out;
  }
};
