/**
 * The editor-side client that replaces the one WF-007 deleted — SB-017 §8.
 *
 * Richard's ruling, given SB-017 §6: **derive the ports in the editor for cloud
 * components**, rather than patching the exporter or the authoring door. The
 * rejected alternatives and why are in the task file; the short version is that
 * deriving at export time only would leave the canvas showing 84 red warnings on
 * a freshly installed project, and stopping the exporter dropping unhealthy
 * connections would make the two paths agree by removing the check rather than
 * feeding it.
 *
 * What each family *is* lives in `nodelibrary/cloudDynamicPorts.ts`, which
 * imports nothing and is graded from `tests-unit/sb-017/`. This file is the
 * plumbing: which nodes to look at, and when to look again.
 *
 * ## One class per node-type family
 *
 * `dynamicPortRules.ts`'s header prescribes a `NodeTypeAdapters` class per
 * family rather than a new `namedports/list` rule, and the three subclasses
 * below are that. They share a sweep because the sweep is genuinely identical —
 * splitting it three ways would be three copies of the same walk, and
 * `setDynamicPorts` **replaces** a node's dynamic port list, so two adapters
 * writing to one node would silently erase each other. The families are
 * therefore partitioned by node type, which is what makes that safe:
 * `JavaScriptFunction`, the Record family, Query Records. `prop-*` and `acl-*`
 * share `RecordPortsAdapter` for exactly that reason — they are two ports sets
 * on one node, as they are in the runtime (`_additionalDynamicPorts` chains onto
 * one list).
 *
 * ## 🔴 Cloud components only
 *
 * Scoped by `isCloudFunctionComponent`, and that is the ruling's own wording
 * rather than caution. A browser component's Function node **already has** these
 * ports: the viewer is a connected runtime client and pushes them over
 * `sendDynamicPorts` (SB-017 §6.1 measured 69 undeclared browser script-port
 * connections raising **0** warnings against the cloud side's 44 raising 44).
 * Running this there would put a second writer on the same `setDynamicPorts`
 * with a *different* list — the viewer's carries `intype-`/`outtype-`/
 * `runOnChange-` too — and the two would overwrite each other on every
 * parameter change. SB-017 acceptance 6 is the negative control on this: those
 * 69 connections must still export once this exists.
 *
 * @module models/NodeTypeAdapters/CloudDynamicPortsAdapter
 */

import {
  cloudDynamicPortsForNode,
  QUERY_TYPES,
  RECORD_READ_TYPES,
  RECORD_WRITE_TYPES,
  SCRIPT_PORT_TYPES,
  type ConnectionLike
} from '@noodl-models/nodelibrary/cloudDynamicPorts';
import { ProjectModel } from '@noodl-models/projectmodel';

import { isCloudFunctionComponent } from '../../utils/exporter/cloudFunctions';

/**
 * The sweep, shared by the three family adapters below.
 *
 * Not exported as an adapter itself: `registeradapters.ts` instantiates what it
 * finds in its `_adapters` map, and a base class in that map would sweep every
 * type twice.
 */
abstract class CloudDynamicPortsAdapter {
  events: Record<string, (e?: TSFixme) => void>;

  /** The node types this adapter owns. Disjoint from every sibling's — see the docblock. */
  protected abstract readonly typenames: readonly string[];

  constructor() {
    this.events = {
      projectLoaded: this.updateAllNodes.bind(this),
      nodeAdded: this.nodeAdded.bind(this),
      parametersChanged: this.parametersChanged.bind(this),
      // 🔴 `prop-*` is derived partly from the wires (see `cloudDynamicPorts.ts`
      // on why the schema cannot answer), so drawing one has to be able to mint
      // its port. Without these two the port arrives only on the next parameter
      // change or project load, and until then the author's new wire is red and
      // would not deploy.
      connectionAdded: this.connectionChanged.bind(this),
      connectionRemoved: this.connectionChanged.bind(this)
    };
  }

  /** Recompute one node's derived ports, if it is one of ours and in a cloud component. */
  updatePortsForNode(node: TSFixme) {
    if (!node || !node.owner) return;
    if (!this.typenames.includes(node.type && node.type.name)) return;

    const component = node.owner.owner;
    if (!component || !isCloudFunctionComponent(component)) return;

    node.setDynamicPorts(
      cloudDynamicPortsForNode(node, node.type.name, (node.owner.connections || []) as ConnectionLike[])
    );
  }

  private nodeAdded(e: TSFixme) {
    this.updatePortsForNode(e && e.args && e.args.model);
  }

  private parametersChanged(e: TSFixme) {
    this.updatePortsForNode(e && e.model);
  }

  /**
   * A wire changed: recompute both of its endpoints.
   *
   * The graph is reached through the connection's owner rather than through
   * `ProjectModel`, so a wire drawn in one component does not start a sweep of
   * every other.
   */
  private connectionChanged(e: TSFixme) {
    // `NodeGraphModel.addConnection` raises this on the *graph*, so the global
    // bridge in `shared/model.js` delivers `{model: <graph>, args: {model: <wire>}}`.
    const graph = e && e.model;
    const connection = e && e.args && e.args.model;
    if (!graph || !connection || typeof graph.findNodeWithId !== 'function') return;

    this.updatePortsForNode(graph.findNodeWithId(connection.fromId));
    this.updatePortsForNode(graph.findNodeWithId(connection.toId));
  }

  /**
   * The initial sweep. Cloud components only, and `forEachNode` in a block body
   * because it aborts the walk on a truthy return.
   */
  private updateAllNodes() {
    if (!ProjectModel.instance) return;
    ProjectModel.instance.forEachComponent((component: TSFixme) => {
      if (!isCloudFunctionComponent(component)) return;
      component.forEachNode((node: TSFixme) => {
        this.updatePortsForNode(node);
      });
    });
  }
}

/** `in-*` / `out-*`, from the two proplists and the parsed script. */
export class CloudScriptPortsAdapter extends CloudDynamicPortsAdapter {
  protected readonly typenames = SCRIPT_PORT_TYPES;
}

/** `prop-*` and `acl-*` on Create Record, Update Record and Record. */
export class CloudRecordPortsAdapter extends CloudDynamicPortsAdapter {
  protected readonly typenames = RECORD_WRITE_TYPES.concat(RECORD_READ_TYPES);
}

/** `qp-*` and the dynamic `Do` on Query Records. */
export class CloudQueryPortsAdapter extends CloudDynamicPortsAdapter {
  protected readonly typenames = QUERY_TYPES;
}

/** Every adapter this module contributes, in the shape a test can drive directly. */
export const CLOUD_DYNAMIC_PORT_ADAPTERS = [
  CloudScriptPortsAdapter,
  CloudRecordPortsAdapter,
  CloudQueryPortsAdapter
];
