/**
 * DEF-002 — a wire to a port that exists.
 *
 * ## The hole, measured rather than assumed
 *
 * The door validates *parameters* thoroughly and *connections* almost not at
 * all. Phase 78's D1 established it by sabotage rather than by reading: three
 * different mistyped connection targets each produced a run **identical to the
 * clean one** — 46 `dynamic-port-skipped` infos, no error, no warning, nothing
 * about the wire.
 *
 * | sabotaged | the door said |
 * |---|---|
 * | `standing.isMember` → `standing.isMemberXX` on a **component instance** | nothing |
 * | `send.in-name` → `send.in-nameXX` on a **CloudFunction2** | nothing |
 * | `goDetail.pm-announcementId` → `pm-noSuchParam` on a **RouterNavigate** | nothing |
 *
 * 🔴 **All three targets are components the door has already resolved on disk**,
 * each declaring its ports in a file the door reads. This module is the first
 * of the three: the component instance.
 *
 * ## Why `nonexistentPort` is right not to cover it
 *
 * `rules/nonexistentPort` skips a node with any dynamic ports rather than guess,
 * and skips component refs outright — both deliberately, and both must stay. A
 * component's ports are not in the catalog, so the rule genuinely cannot see
 * them. **What was wrong was not the skip; it was that nothing else asked.** An
 * `info` saying "unverified" reads, to an agent, as "verified".
 *
 * The answer is not a guess. `componentInterfaceIndex` is built from the same
 * `Component Inputs`/`Component Outputs` declarations `componentmodel.getPorts()`
 * reads, over the same overlaid views the navigation and interface checks
 * already use — so a component this very plan is creating resolves here exactly
 * when it resolves as a navigation target.
 *
 * ## 🔴 The inversion, which is the one way to get this wrong
 *
 * A port authored with plug `"output"` is an **input** of the instance; a port
 * authored with plug `"input"` is an **output**. `componentmodel.getPorts()`
 * republishes each collected port with the opposite plug, and a checker that
 * read the names the obvious way would refuse every correct graph and accept
 * every broken one. The index owns that inversion; this module reads
 * `iface.inputs` for a wire's **target** and `iface.outputs` for its **source**.
 *
 * ## What it deliberately does not do
 *
 * - **A component with no interface at all is skipped.** `InterfacelessInstance`
 *   already reports that component once, with the whole list; adding one error
 *   per wire would turn a single missing node into a wall.
 * - **A reference the index cannot resolve is skipped.** `unresolved-component-ref`
 *   owns it, and two diagnostics for one cause is a repair round spent choosing.
 * - **A port the instance serialises on itself is accepted**, the same exemption
 *   `checkInstanceInterfaces` makes for parameters, and for the same reason:
 *   `NodeGraphNode.getPorts` honours those too.
 *
 * Pure — the caller supplies the nodes, the wires and the index.
 *
 * @module noodl-editor/validation/connectionTargets
 */

import type { ComponentInterface, ComponentInterfaceIndex } from './componentInterface';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import { isComponentRef, refToPath } from './model';
import { nearest } from './CatalogIndex';

/** How many port names a message will list before it stops being readable. */
const MAX_ALTERNATIVES = 24;

/** A connection, in the shape both doors already hold it. */
export interface ConnectionLike {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** The nodes this check reads — the same shape the other value checks take. */
export interface InstanceNodeLike {
  id: string;
  type: string;
  label?: string;
  ports?: readonly { name?: unknown }[] | null;
}

export interface CheckConnectionTargetsOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Every component's interface. A name absent from it is simply not checked. */
  interfaces: ComponentInterfaceIndex;
  /**
   * The candidate's connections. **Omitted means "do not check"** — the
   * convention every option in this layer follows. A caller that cannot supply
   * wires has nothing for this check to read.
   */
  wires?: readonly ConnectionLike[];
  /** Severity for these findings. Defaults to `error` — see the code's note. */
  severity?: Severity;
}

/** The ports a node declares on itself, which `NodeGraphNode.getPorts` also honours. */
function ownPortNames(node: InstanceNodeLike): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(node.ports)) return out;
  for (const port of node.ports) {
    if (port && typeof port === 'object' && typeof port.name === 'string') out.add(port.name);
  }
  return out;
}

function resolve(interfaces: ComponentInterfaceIndex, type: string): ComponentInterface | undefined {
  return interfaces.get(type) ?? interfaces.get(refToPath(type));
}

/**
 * Connections whose endpoint names a port the target component does not declare.
 *
 * One diagnostic per offending endpoint, carrying the component's real port list
 * as `alternatives` and the nearest name as `suggestion` — the "did you mean"
 * shape the LAS-001 audit measured a 100% self-correction rate on.
 */
export function checkConnectionTargets(
  nodes: readonly InstanceNodeLike[],
  options: CheckConnectionTargetsOptions
): Diagnostic[] {
  const { component, interfaces, wires, severity = 'error' } = options;
  if (!wires || wires.length === 0) return [];

  const instances = new Map<string, InstanceNodeLike>();
  for (const node of nodes) {
    if (isComponentRef(node.type)) instances.set(node.id, node);
  }
  if (instances.size === 0) return [];

  const diagnostics: Diagnostic[] = [];

  for (const wire of wires) {
    // 🔴 `plug` here is the plug ON THE INSTANCE: a wire's `to` end lands on an
    // instance INPUT, its `from` end leaves an instance OUTPUT. The inversion
    // against how the ports were authored lives in the index, not here.
    const endpoints: Array<{
      id: string;
      port: string;
      plug: 'input' | 'output';
      declaredBy: string;
      field: string;
    }> = [
      { id: wire.toId, port: wire.toProperty, plug: 'input', declaredBy: 'Component Inputs', field: 'toProperty' },
      {
        id: wire.fromId,
        port: wire.fromProperty,
        plug: 'output',
        declaredBy: 'Component Outputs',
        field: 'fromProperty'
      }
    ];

    for (const { id, port, plug, declaredBy, field } of endpoints) {
      const node = instances.get(id);
      if (!node) continue; // not a component instance in this candidate
      if (typeof port !== 'string' || port.length === 0) continue;

      const iface = resolve(interfaces, node.type);
      if (!iface) continue; // `unresolved-component-ref` owns an unknown target

      const available = plug === 'input' ? iface.inputs : iface.outputs;
      // A component with nothing at all in this direction is `InterfacelessInstance`'s
      // to report, once, with the whole picture — not this rule's, once per wire.
      if (available.length === 0) continue;
      if (available.includes(port)) continue;
      if (ownPortNames(node).has(port)) continue;

      const label = node.label ? `"${node.label}"` : node.type;
      const consequence =
        plug === 'input'
          ? 'The value never arrives and the instance renders as though nothing was connected.'
          : 'The wire carries nothing — the port never fires, so whatever it was meant to trigger never runs, ' +
            'and the failure is silent: an empty screen rather than an error.';

      diagnostics.push({
        code: DiagnosticCode.ConnectionUnknownInstancePort,
        severity,
        message:
          `Connection names ${plug === 'input' ? 'input' : 'output'} "${port}" on the component instance ` +
          `${label}, and ${node.type} has no such ${plug}. Its ${declaredBy} node declares ` +
          `${available.length}: ${available
            .slice(0, MAX_ALTERNATIVES)
            .map((n) => `"${n}"`)
            .join(', ')}. ${consequence}`,
        location: {
          component,
          nodeId: id,
          nodeType: node.type,
          nodeLabel: node.label,
          port,
          plug,
          connection: {
            fromId: wire.fromId,
            fromProperty: wire.fromProperty,
            toId: wire.toId,
            toProperty: wire.toProperty
          }
        },
        suggestion: nearest(port, [...available]) ?? `Write ${field} as one of ${available.slice(0, 6).join(', ')}.`,
        alternatives: available.slice(0, MAX_ALTERNATIVES)
      });
    }
  }

  return diagnostics;
}
