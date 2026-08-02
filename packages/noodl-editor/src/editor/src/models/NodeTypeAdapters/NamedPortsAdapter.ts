import { generatedPortsForNode, typeGeneratesNamedPorts } from '@noodl-models/nodelibrary/dynamicPortRules';
import { ProjectModel } from '@noodl-models/projectmodel';

/**
 * WFA-009 — the one evaluator behind `namedports/list`.
 *
 * Unlike every other adapter here this one is **not bound to a node type**. It
 * listens to the unsuffixed events (the registry fans out to both the global and
 * the `:<typename>` list) and acts on any node whose *type* declares a
 * value-derived port rule. That is the point of the decision recorded in
 * WFA-009-ASSESSMENT.md §2: `noodl.cloud.request` and `noodl.cloud.response`
 * differ only by `plug` and a condition, so the algorithm is written once and the
 * difference is data. A third node with the same shape adds a library entry and
 * nothing here changes.
 *
 * The single call it makes — `node.setDynamicPorts(...)` — is the same one
 * `PageInputsAdapter` has made for years, so everything downstream
 * (`instancePortsChanged`, the property panel, `evaluateConnectionHealth`,
 * universal search) is reached by a path that already exists. Removing a name
 * therefore removes its port and raises the ordinary *"Target port doesn't
 * exist."* warning on any connection left behind, which is exactly how every
 * other disappearing dynamic port behaves.
 *
 * @module models/NodeTypeAdapters/NamedPortsAdapter
 */
export class NamedPortsAdapter {
  events: Record<string, (e?: unknown) => void>;

  constructor() {
    this.events = {
      projectLoaded: this.updateAllNodes.bind(this),
      nodeAdded: this.nodeAdded.bind(this),
      parametersChanged: this.parametersChanged.bind(this)
    };
  }

  /**
   * Recompute one node's generated ports.
   *
   * `setDynamicPorts` compares before it writes, so a node whose parameters did
   * not affect its ports costs one array build and no notification — which is
   * what makes it safe to call this from a global `parametersChanged`.
   */
  updatePortsForNode(node: TSFixme) {
    if (!node || !typeGeneratesNamedPorts(node.type)) return;
    node.setDynamicPorts(generatedPortsForNode(node));
  }

  private nodeAdded(e: TSFixme) {
    this.updatePortsForNode(e && e.args && e.args.model);
  }

  private parametersChanged(e: TSFixme) {
    this.updatePortsForNode(e && e.model);
  }

  /**
   * The initial sweep. Every node in the project, not `getNodesWithType`, because
   * which types carry a rule is a property of the library rather than of this
   * class — asking each node's type keeps the two from having to be listed in
   * two places.
   */
  private updateAllNodes() {
    if (!ProjectModel.instance) return;
    ProjectModel.instance.forEachComponent((component) => {
      // Block body, not an expression body: `forEachNode` aborts the walk on a
      // truthy return (the F-class trap recorded in the 2026-07-26 batch notes).
      component.forEachNode((node: TSFixme) => {
        this.updatePortsForNode(node);
      });
    });
  }
}
