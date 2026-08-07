/**
 * Rule: connected ports carry compatible value types.
 *
 * Using the catalog's typecast matrix, a wire from an output of type A to an
 * input of type B is compatible when A === B, either side is the wildcard `*`,
 * a signal is involved, or the matrix lists B reachable from A.
 *
 * Severity is `warning`: the runtime coerces liberally and the catalog's type
 * model is incomplete, so a mismatch is "probably wrong", not "provably wrong"
 * (the task's guidance: where uncertain, warn rather than error). The rule only
 * considers pairs where BOTH port types are statically known — component
 * instances, unknown types, and runtime-created ports are skipped entirely, so
 * it never fires on something it cannot actually see.
 *
 * @module noodl-editor/validation/rules/typeIncompatibleConnection
 */

import { CatalogIndex } from '../CatalogIndex';
import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { isComponentRef } from '../model';
import { Rule, RuleContext } from './types';

export const typeIncompatibleConnection: Rule = {
  code: DiagnosticCode.TypeIncompatibleConnection,
  description: 'Connected ports carry compatible value types (per the typecast matrix).',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const { catalog } = ctx;

    for (const { component, nodeById } of ctx.components) {
      for (const conn of component.connections) {
        const from = nodeById.get(conn.fromId);
        const to = nodeById.get(conn.toId);
        if (!from || !to) continue;
        if (isComponentRef(from.type) || isComponentRef(to.type)) continue;
        if (!catalog.hasType(from.type) || !catalog.hasType(to.type)) continue;

        const fromPort = catalog.getPort(from.type, 'output', conn.fromProperty);
        const toPort = catalog.getPort(to.type, 'input', conn.toProperty);
        // Only proceed when both ports are statically known (so their types are real).
        if (!fromPort || !toPort) continue;

        const fromType = CatalogIndex.portTypeName(fromPort);
        const toType = CatalogIndex.portTypeName(toPort);
        if (catalog.isTypeCompatible(fromType, toType)) continue;

        out.push({
          code: DiagnosticCode.TypeIncompatibleConnection,
          severity: 'warning',
          message:
            `Type mismatch: ${from.type}.${conn.fromProperty} (${fromType}) → ` +
            `${to.type}.${conn.toProperty} (${toType}). No known conversion from ` +
            `"${fromType}" to "${toType}"; the value may not arrive as expected.`,
          location: {
            component: component.name,
            nodeId: to.id,
            nodeType: to.type,
            nodeLabel: to.label,
            port: conn.toProperty,
            plug: 'input',
            connection: {
              fromId: conn.fromId,
              fromProperty: conn.fromProperty,
              toId: conn.toId,
              toProperty: conn.toProperty
            }
          }
        });
      }
    }
    return out;
  }
};
