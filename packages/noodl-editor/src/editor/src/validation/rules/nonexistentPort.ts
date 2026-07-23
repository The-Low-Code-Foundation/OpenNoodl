/**
 * Rule: every connection endpoint names a port that exists on its node.
 *
 * **This rule is the crux of the task.** A node's ports come from three places:
 *   1. the catalog's static inputs/outputs (incl. declared-port-group members),
 *   2. ports serialised on the node instance (node.ports / node.dynamicports),
 *   3. ports the node creates *at runtime* (Function outputs, Expression inputs,
 *      numbered And/Or inputs, a referenced component's ports, …).
 *
 * We can only see (1) and (2). For (3) we must not guess: reporting "port does
 * not exist" for a runtime-created port would flood real projects with false
 * errors and destroy trust in the validator. So:
 *   - port found in (1) or (2)                         → OK
 *   - not found, but the node has ANY dynamic ports    → skip (optional info)
 *   - not found, and the node is fully static          → error
 *
 * This is exactly the behaviour the SUB-004 corpus preview proved clean: zero
 * static-port false positives across the entire real-project corpus, while
 * ~2000 runtime-created ports were correctly skipped.
 *
 * @module noodl-editor/validation/rules/nonexistentPort
 */

import { CatalogIndex, Plug } from '../CatalogIndex';
import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormNode, isComponentRef } from '../model';
import { Rule, RuleContext } from './types';

const MAX_ALTERNATIVES = 24;

function availableAlternatives(catalog: CatalogIndex, type: string, plug: Plug): string[] {
  // For inputs, lead with signal inputs — "how do I trigger this" is the most
  // common near-miss — then the rest, capped so the message stays readable.
  const all = catalog.portNames(type, plug);
  if (plug === 'input') {
    const signals = new Set(catalog.signalInputNames(type));
    const ordered = [...all].sort((a, b) => {
      const sa = signals.has(a) ? 0 : 1;
      const sb = signals.has(b) ? 0 : 1;
      return sa !== sb ? sa - sb : a < b ? -1 : 1;
    });
    return ordered.slice(0, MAX_ALTERNATIVES);
  }
  return all.slice(0, MAX_ALTERNATIVES);
}

export const nonexistentPort: Rule = {
  code: DiagnosticCode.NonexistentPort,
  description: 'Every connection endpoint names a port that exists on its node.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const { catalog } = ctx;

    for (const { component, nodeById } of ctx.components) {
      for (const conn of component.connections) {
        const endpoints: Array<{ node: NormNode | undefined; port: string; plug: Plug }> = [
          { node: nodeById.get(conn.fromId), port: conn.fromProperty, plug: 'output' },
          { node: nodeById.get(conn.toId), port: conn.toProperty, plug: 'input' }
        ];

        for (const { node, port, plug } of endpoints) {
          if (!node) continue; // dangling — danglingConnection owns this
          if (isComponentRef(node.type)) continue; // component ports are per-instance/dynamic
          if (!catalog.hasType(node.type)) continue; // unknown type — unknownNodeType owns this

          ctx.counters.endpointsChecked++;

          if (catalog.hasPort(node.type, plug, port)) continue; // (1)
          if (node.instancePorts.includes(port)) continue; // (2)

          if (catalog.isDynamicNode(node.type)) {
            // (3) — runtime/adapter/numbered/component ports. Never an error.
            if (ctx.options.emitDynamicPortInfo) {
              out.push({
                code: DiagnosticCode.DynamicPortSkipped,
                severity: 'info',
                message:
                  `Port "${port}" on ${node.type} could not be statically verified: ` +
                  (catalog.dynamicPortNote(node.type) ?? 'this node determines ports at runtime') +
                  '. Skipped.',
                location: {
                  component: component.name,
                  nodeId: node.id,
                  nodeType: node.type,
                  nodeLabel: node.label,
                  port,
                  plug
                }
              });
            }
            continue;
          }

          // Fully static node — a missing port here is a real error.
          const suggestion = catalog.suggestPort(node.type, plug, port);
          const alternatives = availableAlternatives(catalog, node.type, plug);
          out.push({
            code: DiagnosticCode.NonexistentPort,
            severity: 'error',
            message: `${node.type} has no ${plug} named "${port}".`,
            location: {
              component: component.name,
              nodeId: node.id,
              nodeType: node.type,
              nodeLabel: node.label,
              port,
              plug,
              connection: {
                fromId: conn.fromId,
                fromProperty: conn.fromProperty,
                toId: conn.toId,
                toProperty: conn.toProperty
              }
            },
            suggestion,
            alternatives
          });
        }
      }
    }
    return out;
  }
};
