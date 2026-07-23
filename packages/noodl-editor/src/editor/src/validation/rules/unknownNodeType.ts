/**
 * Rule: every `node.type` resolves to a catalog entry.
 *
 * Component references (`/#Foo`) are handled by `unresolvedComponentRef` — this
 * rule ignores them and only checks library node types.
 *
 * Severity is `warning`, not `error`, by default. The catalog enumerates the
 * core runtime vocabulary; real projects legitimately contain module-provided
 * nodes and nodes from other Noodl versions/forks the catalog cannot list.
 * Erroring on those is the "cries wolf" failure this task is built to avoid. The
 * warning still carries a "did you mean X?" suggestion, so an AI authoring
 * `Butonn` gets an actionable fix from the message alone. `--strict` promotes
 * these to errors for projects authored entirely against the catalog.
 *
 * @module noodl-editor/validation/rules/unknownNodeType
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { isComponentRef } from '../model';
import { Rule, RuleContext } from './types';

export const unknownNodeType: Rule = {
  code: DiagnosticCode.UnknownNodeType,
  description: 'Every node type resolves to a catalog entry (or a component reference).',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const severity = ctx.options.strict ? 'error' : 'warning';
    for (const { component } of ctx.components) {
      for (const node of component.nodes) {
        if (isComponentRef(node.type)) continue; // handled elsewhere
        if (ctx.catalog.hasType(node.type)) continue;

        const suggestion = ctx.catalog.suggestType(node.type);
        let message = `Unknown node type "${node.type}" — not found in the node catalog.`;
        if (!suggestion) {
          message +=
            ' If this is a module-provided node, ensure the module is installed;' +
            ' otherwise it may be a legacy or misspelt type.';
        }
        out.push({
          code: DiagnosticCode.UnknownNodeType,
          severity,
          message,
          location: {
            component: component.name,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label
          },
          suggestion
        });
      }
    }
    return out;
  }
};
