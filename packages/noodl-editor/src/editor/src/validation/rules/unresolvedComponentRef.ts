/**
 * Rule: every component-instance node type resolves to a project component.
 *
 * A node whose type is a component reference (`/#Header`, `/Pages/Home`) must
 * name a component that exists in the project (equivalently, a key in the v2
 * `_registry.json`). A broken reference is a definite error — the instance can
 * never mount — so this is `error` severity. The whole real-project corpus
 * resolves cleanly, so a firing here is a genuine problem (a renamed or deleted
 * component left a dangling instance).
 *
 * @module noodl-editor/validation/rules/unresolvedComponentRef
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { isComponentRef, refToPath } from '../model';
import { nearest } from '../CatalogIndex';
import { Rule, RuleContext } from './types';

export const unresolvedComponentRef: Rule = {
  code: DiagnosticCode.UnresolvedComponentRef,
  description: 'Every component-reference node resolves against the project registry.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const refs = ctx.project.componentRefs;
    const candidates = [...refs];
    for (const { component } of ctx.components) {
      for (const node of component.nodes) {
        if (!isComponentRef(node.type)) continue;
        if (refs.has(node.type) || refs.has(refToPath(node.type))) continue;

        const suggestion = nearest(node.type, candidates) ?? nearest(refToPath(node.type), candidates);
        out.push({
          code: DiagnosticCode.UnresolvedComponentRef,
          severity: 'error',
          message:
            `Component reference "${node.type}" does not resolve to any component in the project. ` +
            'The referenced component may have been renamed or deleted.',
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
