import { find, clone } from 'underscore';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';

export function exportConnection(other: { fromId: string; fromProperty: string; toId: string; toProperty: string }) {
  return {
    sourceId: other.fromId,
    sourcePort: other.fromProperty,
    targetId: other.toId,
    targetPort: other.toProperty
  };
}

export function exportPorts(node: TSFixme) {
  const exports = [];
  const ports = node.getPorts();
  for (const i in ports) {
    const p = ports[i];

    // Ignore ports with types that are not resolved
    if (NodeLibrary.nameForPortType(p.type) === '=') continue;

    // Only instances ports are exported. Export the port if it is not a type port
    if (
      node.type.exportDynamicPorts &&
      !find(node.type.ports, function (_p) {
        return _p.name === p.name;
      })
    ) {
      exports.push(p);
    }
  }
  return exports;
}

export function exportNode(node: NodeGraphNode) {
  const json = {
    id: node.id,
    type: node.type.name,
    version: node.version,
    variant: node.variant ? node.variant.name : undefined,
    parameters: clone(node.parameters),
    stateParameters: node.stateParameters ? clone(node.stateParameters) : undefined,
    stateTransitions: node.stateTransitions ? clone(node.stateTransitions) : undefined,
    defaultStateTransitions: node.defaultStateTransitions ? clone(node.defaultStateTransitions) : undefined,
    ports: exportPorts(node),
    children: []
  };

  for (const i in node.children) {
    const child = node.children[i];

    json.children.push(exportNode(child));
  }

  return json;
}

export function exportComponent(comp: ComponentModel) {
  /**
   * DEF-028 (phase 80) · P77 D13 — settle connection health before reading it.
   *
   * The connection loop below drops every wire `getConnectionHealth` calls
   * unhealthy, and that verdict comes from a debounced pass that nothing forced
   * to land. Without this, what a build contains depends on when it was taken
   * rather than on what the project says — silently, and in both directions.
   *
   * 🔴 Done here, in the filter, rather than at the call sites, because there
   * are **eight** of them across seven entry points — component bundles
   * (`editorapi`), incremental preview updates (`ViewerConnection`), the full
   * export and deploy (`json.ts`, `deployer.ts`), cloud functions, and the AI
   * authoring sandbox (`sandboxExport`, `componentBench`). One of them missing
   * the call is the defect again, so no caller is trusted to make it. Anything
   * added later gets it by construction.
   *
   * ⚠️ Deliberately NOT inside `getConnectionHealth`: its other caller is
   * `NodeGraphEditorConnection`, which asks once per wire per repaint.
   */
  comp.graph.flushEvaluateHealth();

  const json: TSFixme = { name: comp.name };

  json.nodes = [];
  json.connections = [];
  json.ports = [];
  json.roots = [];
  json.metadata = comp.metadata;

  // Export roots
  for (const i in comp.graph.roots) {
    const n = comp.graph.roots[i];

    json.nodes.push(exportNode(n));

    // Add nodes that may be children to the root array
    if (n.type.allowAsChild) json.roots.push(n.id);
  }

  // Export connections
  for (const i in comp.graph.connections) {
    const c = comp.graph.connections[i];

    /**
     * DEF-034 (phase 80) — **only an `error` deletes a wire.**
     *
     * `getConnectionHealth` used to answer with any recorded warning, at any level, and this
     * filter treated all of them as "cannot work". Two of the seven connection keys are
     * deliberately `level: 'warning'` — `con-target-port-gated` says the wire *"is valid and its
     * value is ignored"*, and `con-type-unconverted` says the value arrives, just unconverted.
     * Deleting those wires is strictly worse than keeping them: a gate that flips at runtime, or
     * a cast the author accepted, then has nothing delivering a value at all.
     */
    const health = comp.graph.getConnectionHealth(
      {
        sourceId: c.fromId,
        sourcePort: c.fromProperty,
        targetId: c.toId,
        targetPort: c.toProperty
      },
      { levels: ['error'] }
    );
    if (health.healthy) {
      json.connections.push(exportConnection(c));
    }
  }

  // Export component ports
  const ports = comp.getPorts();
  for (const i in ports) {
    const p = ports[i];

    // Only export types that are resolved
    if (p.type) json.ports.push(p);
  }

  return json;
}

/** TODO: Where is this used? */
export function getNodesWithType(type: TSFixme, allComponents: TSFixme) {
  const result = [];

  allComponents.forEach((c) => {
    c.forEachNode((n) => {
      if (n.type.name === type) {
        result.push(n);
      }
    });
  });

  return result;
}

export function exportSettings(project: TSFixme) {
  const settings = project ? project.getSettings() : {};
  const result = {};

  const p = NodeLibrary.instance.getProjectSettingsPorts();
  const settingsPorts = (p.ports || []).concat(p.dynamicports || []);

  for (const prop in settings) {
    const port = settingsPorts.find((p) => p.name === prop);
    if (!port || !port.ignoreInExport) {
      result[prop] = settings[prop];
    }
  }

  return result;
}

export function exportVariant(variant: TSFixme) {
  return {
    name: variant.name,
    typename: variant.typename,
    parameters: variant.parameters,
    stateParameters: variant.stateParameters,
    stateTransitions: variant.stateTransitions,
    defaultStateTransitions: variant.defaultStateTransitions
  };
}
