/**
 * AAQ-005 — an instance port that exists.
 *
 * Found by converging the two authoring vocabularies rather than by looking for
 * it, which is the third time in this phase that making two clients agree
 * uncovered something neither of them checked.
 *
 * A node's declared instance ports are the only way to author a component's
 * interface: `Component Inputs` and `Component Outputs` carry
 * `haveComponentPorts`, and `componentmodel`'s interface derivation reads
 * `getPorts('input')` and `getPorts('output')` on those nodes to decide what the
 * component's inputs and outputs *are*. `NodeGraphNode.getPorts(filter)` selects
 * with `p.plug && p.plug.indexOf(filter) !== -1` — so a port with no `plug` lands
 * in neither map and is **inert**. It is written to disk, it passes the structural
 * schema (`nodes.schema.json` requires only `name`), the canvas shows nothing, and
 * the component silently has no such input. The agent believes it built an
 * interface and built nothing.
 *
 * Nothing told it and nothing checked it. MCP's port schema was `{ name }` with
 * `.passthrough()`, so `plug` was not even mentioned on that door; the editor's
 * schema declared it required, but that schema is instruction only —
 * `toSubmitPayload` casts the model's arguments unchecked. Both doors now describe
 * the field (`authoringVocabulary`) and both gates now check it.
 *
 * Error severity. Calibrated on all three populations this gate sees, because a
 * rule calibrated on the project corpus is not calibrated on the authored one:
 * the 96-project corpus declares **1483 instance ports, 1483 of them with a
 * plug**; the 15 AI spec files and `noodl-mcp`'s fixtures declare none without
 * one. Zero hits in all three. A plug-less instance port is not something anyone
 * has ever meant to write.
 *
 * Pure — the caller supplies the nodes.
 *
 * @module noodl-editor/validation/instancePorts
 */

import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/**
 * What an authored instance port looks like before anything validates it. Open
 * by design: the stored port definition sets `additionalProperties: true` and a
 * real port carries `type`, `index`, `group` and `displayName` besides these two.
 */
export interface AuthoredPortLike {
  name?: unknown;
  plug?: unknown;
  [key: string]: unknown;
}

/** The nodes this check reads — the same shape the other value checks take. */
export interface PortDeclaringNode {
  id: string;
  type: string;
  label?: string;
  ports?: readonly AuthoredPortLike[] | null;
}

export interface CheckInstancePortsOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /** Severity for these findings. Defaults to `error` — see the module note above. */
  severity?: Severity;
}

const VALID_PLUGS = ['input', 'output', 'input/output'];

/**
 * Declared instance ports the editor will never show.
 *
 * Deliberately not restricted to `Component Inputs`/`Component Outputs`. Those
 * are the nodes where the consequence is a missing component interface, but
 * `getPorts` filters on `plug` for every node, so a plug-less port is dead
 * wherever it is declared — and the check has no view of which types carry
 * `haveComponentPorts` (that lives in the node library, which this layer does not
 * import).
 *
 * A port with a `plug` this does not recognise is reported too: `getPorts`
 * substring-matches on the value, so `"in"` matches neither filter and behaves
 * exactly like an absent one.
 */
export function checkInstancePorts(
  nodes: readonly PortDeclaringNode[],
  options: CheckInstancePortsOptions
): Diagnostic[] {
  const { component, severity = 'error' } = options;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    // `ports` arrives from model output; a non-array is a shape error the
    // candidate builder already reports, so it is skipped rather than iterated.
    if (!Array.isArray(node.ports)) continue;
    const where = node.label ? `"${node.label}"` : node.type;

    for (const port of node.ports) {
      if (port === null || typeof port !== 'object') continue;
      const name = typeof port.name === 'string' && port.name.trim() ? port.name.trim() : undefined;
      const plug = typeof port.plug === 'string' ? port.plug.trim() : undefined;
      if (plug && VALID_PLUGS.includes(plug)) continue;

      diagnostics.push({
        code: DiagnosticCode.PortWithoutPlug,
        severity,
        message:
          `Port "${name ?? '(unnamed)'}" on ${where} has ` +
          (plug ? `plug "${plug}", which is not a direction` : 'no "plug"') +
          ' — so it is not an input or an output, and nothing can connect to it.',
        location: { component, nodeId: node.id, nodeType: node.type, ...(name ? { port: name } : {}) },
        suggestion:
          'Set "plug" to "output" for a port on a Component Inputs node (values flow out of it into this ' +
          'graph) or "input" for a port on a Component Outputs node.'
      });
    }
  }

  return diagnostics;
}
