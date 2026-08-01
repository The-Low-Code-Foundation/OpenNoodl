/**
 * The sentence a placed node carries when its backend cannot serve it.
 *
 * Separated from `NodeGraphNode.evaluateHealth` so the model file gains one
 * call rather than an import of the whole gating stack, and so the rule is
 * testable without a graph.
 */

import { gateForNode, gateForPort, gateSentence, resolveGateTarget, type GateTarget } from './index';

/** Anything with a type name, a parameter bag and a port list. */
interface NodeLike {
  typename?: string;
  type?: { name?: string; localName?: string };
  parameters?: Record<string, unknown>;
  getPorts?: (plug?: string) => Array<{ name: string }>;
}

/**
 * The warning text for a node, or `undefined`.
 *
 * Both halves are reported, because they are different problems: a node whose
 * whole purpose the backend refuses, and a node that works but whose *port* is
 * dead. The property panel already explains the second in place, so the canvas
 * only summarises it — a builder should not have to open the panel to discover
 * that a wire they attached goes nowhere.
 *
 * ⚠️ A `degraded` gate is reported too. It is the state most easily lost: the
 * node works, so nothing else on screen says anything, and the caveat — "Directus
 * has no way to add to a number in one step, so NodeGX reads the value and writes
 * it back" — is exactly the kind of fact that turns into a bug report about
 * concurrent writes six months later.
 */
export function capabilityWarningFor(node: NodeLike): string | undefined {
  const typeName = node.type?.name || node.type?.localName || node.typename;
  if (!typeName) return undefined;

  let target: GateTarget;
  try {
    target = resolveGateTarget(node.parameters?.backendId as string | undefined);
  } catch (e) {
    return undefined;
  }
  if (!target.type) return undefined;

  const lines: string[] = [];

  const nodeGate = gateForNode(typeName, target);
  if (nodeGate && nodeGate.effective !== 'supported') {
    const sentence = gateSentence(nodeGate, target);
    if (sentence) lines.push(escapeHtml(sentence));
  }

  // Ports are looked up from the node's own list rather than from the binding
  // table, so a port that is not currently declared — the Record family's are
  // schema-driven and come and go — is not warned about.
  let portNames: string[] = [];
  try {
    portNames = (node.getPorts?.('input') || []).map((port) => port.name);
  } catch (e) {
    portNames = [];
  }

  for (const portName of portNames) {
    const gate = gateForPort(typeName, portName, target);
    if (!gate || gate.effective === 'supported') continue;
    const sentence = gateSentence(gate, target);
    if (sentence) lines.push(`${escapeHtml(portName)}: ${escapeHtml(sentence)}`);
  }

  return lines.length ? lines.join('<br>') : undefined;
}

/**
 * The warning message is set with `innerHTML` by the tooltip layer, and one of
 * these sentences is user input by design — a `custom` backend's descriptor is
 * filled in by the user in the Backend Services panel.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
