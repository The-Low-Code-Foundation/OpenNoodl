/**
 * Rule: no connection references a node that does not exist.
 *
 * A wire whose `fromId` or `toId` names a missing node is dangling — it can
 * never carry a value. This is a pure integrity check (no catalog involved) and
 * an unambiguous `error`. The corpus has zero dangling connections, so a firing
 * is a real defect (usually a node deleted without cleaning up its wires).
 *
 * @module noodl-editor/validation/rules/danglingConnection
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

export const danglingConnection: Rule = {
  code: DiagnosticCode.DanglingConnection,
  description: 'No connection endpoint references a missing node.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const { component, nodeById } of ctx.components) {
      for (const conn of component.connections) {
        const fromMissing = !nodeById.has(conn.fromId);
        const toMissing = !nodeById.has(conn.toId);
        if (!fromMissing && !toMissing) continue;

        const missing = fromMissing && toMissing
          ? `both endpoints (${conn.fromId}, ${conn.toId})`
          : fromMissing
            ? `source node "${conn.fromId}"`
            : `target node "${conn.toId}"`;
        out.push({
          code: DiagnosticCode.DanglingConnection,
          severity: 'error',
          message:
            `Connection ${conn.fromId}.${conn.fromProperty} → ${conn.toId}.${conn.toProperty} ` +
            `references a missing node: ${missing}.`,
          location: {
            component: component.name,
            nodeId: fromMissing ? conn.toId : conn.fromId,
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
