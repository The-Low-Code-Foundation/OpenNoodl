import { each, some } from 'underscore';

import { CommentsModel } from '@noodl-models/commentsmodel';
import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode, NodeGraphNodeSet } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { UndoQueue } from '@noodl-models/undo-queue-model';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { guid } from '@noodl-utils/utils';

import { reasonsForGatedPorts } from '@noodl-models/nodelibrary/portGateReason';

import Model from '../../../../shared/model';
import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { unconvertedCast } from './connectionCoercion';

export type Connection = {
  fromProperty: string;
  fromId: string;
  toProperty: string;
  toId: string;
  /** Diff/review presentation only — transient, never serialised (AIX-003). */
  annotation: 'Deleted' | 'Changed' | 'Created' | undefined;
  /**
   * Author-written text shown on the wire (CAN-002). Absent when never set —
   * never `undefined` or `''`, so a wire that was clicked and left alone does
   * not churn `project.json`.
   *
   * Flat keys rather than a nested `metadata`, matching the four above, and
   * separate from `labelT` because they mean different things to version
   * control: `label` is meaning, `labelT` is where it sits.
   */
  label?: string;
  /** Normalised position of the label along the curve, 0.15–0.85 (CAN-001). */
  labelT?: number;
  /**
   * How a **square** wire is routed (SIG-007) — the positions of its runs.
   *
   * `xs[i]` is a fraction of the horizontal gap between the two ports; `ys[j]`
   * is an offset in graph px from the source port's row; runs alternate, and
   * `xs.length === ys.length + 1` because the first and last runs belong to the
   * ports. **Absent when the wire has never been routed**, so a wire that was
   * routed and reset is indistinguishable from one that never was and
   * `project.json` does not churn.
   *
   * ⚠️ Only square wires have one. A curved wire is a *look*, not a routing
   * mode — that decision is what makes this a list of runs rather than a list of
   * points, since a point has nowhere to record "this run moved 40px left".
   *
   * Structural rather than an import of `wireRouting.WireRoute`: the geometry
   * lives in the canvas painter's directory and a model does not reach into a
   * view.
   */
  route?: { xs: number[]; ys: number[] };
};

type NodeGraphModelJson = {
  roots: TSFixme[];
  visualRoots: string[];
  connections: Connection[];
  comments: NodeGraphModelJson[] | undefined;
};

/**
 * The ordinary health-pass debounce. A pass walks every node and every
 * connection in the graph, and its bulk callers (`updateTypes`, module
 * registration, type renames) fire in storms during load — so it is deliberately
 * lazy.
 */
const EVALUATE_HEALTH_DEBOUNCE_MS = 2000;

/**
 * FIX-007 fix 4 — the urgent lane.
 *
 * `evaluateConnectionHealth` raises `con-no-target-port` whenever a wire's
 * endpoint is not in `getPort()`. For a **runtime-discovered** port that verdict
 * is correct and temporary: the ports do not exist until the running viewer
 * mints them and pushes them back (`instanceports` → `setDynamicPorts` →
 * `Model.instancePortsChanged`). The wire is fine; the editor does not know yet.
 *
 * Clearing it was reaching the user ~2 s late, because the only route from the
 * ports arriving to a re-evaluation is `instancePortsChanged` →
 * `scheduleUpdateTypes` (1 ms) → `updateTypes` → `scheduleEvaluateHealth`
 * (2000 ms). Two seconds of red on a wire that was never wrong — and the user
 * report this fix comes from is somebody deleting and redrawing that wire.
 *
 * This is a second, faster lane rather than a smaller number for everybody: the
 * bulk callers still want the lazy pass. It is taken only when the node's own
 * wires actually carry a stale unresolved-port warning
 * (`hasUnresolvedPortWarning`), so ports arriving for a healthy node schedule
 * nothing at all.
 */
const URGENT_EVALUATE_HEALTH_DEBOUNCE_MS = 50;

/**
 * The two warning keys that ports arriving can legitimately clear. Deliberately
 * *not* the `-type` or `con-type-mismatch` keys: those describe a wire that is
 * wrong about types, and a port appearing does not make them stale.
 */
const UNRESOLVED_PORT_WARNING_KEYS = ['con-no-source-port', 'con-no-target-port'];

export class NodeGraphModel extends Model {
  roots: NodeGraphNode[];

  connections: Connection[];
  commentsModel: CommentsModel;
  nodeMap: Map<string, NodeGraphNode>;

  public owner: ComponentModel;
  boundTypeModels: Set<TSFixme>;

  private evaluatehealthScheduled: boolean;
  private updateTypesScheduled: boolean;

  /**
   * The pending health pass, so an urgent request can pre-empt a lazy one that
   * is already in flight. The old code kept only a boolean, which meant
   * `if (scheduled) return` silently swallowed the faster request — exactly the
   * case FIX-007 fix 4 exists for.
   */
  private evaluatehealthTimer: ReturnType<typeof setTimeout> | undefined;
  private evaluatehealthDeadline = Infinity;

  constructor(args?) {
    super();

    this.roots = [];

    this.connections = [];
    this.commentsModel = new CommentsModel({ comments: args ? args.comments : [] });

    //keep track of all nodes in a an id=>model map for better findNodeWithId() performance
    this.nodeMap = new Map();
    this.boundTypeModels = new Set();

    this.bindModels();
  }

  static fromJSON(json: Partial<NodeGraphModelJson>) {
    const _this = new NodeGraphModel({ comments: json.comments });
    for (const i in json.roots) {
      _this.addRoot(NodeGraphNode.fromJSON(json.roots[i]));
    }

    for (const i in json.connections) {
      _this.addConnection(json.connections[i]);
    }

    return _this;
  }

  dispose() {
    EventDispatcher.instance.off(this);
    NodeLibrary.instance.off(this);
    this.boundTypeModels.forEach((type) => type.off && type.off(this));
    this.boundTypeModels.clear();
    this.removeAllListeners();

    // A pending health pass on a disposed graph walks nodes whose component is
    // gone. Harmless before, because nothing held the handle to cancel it.
    if (this.evaluatehealthTimer !== undefined) clearTimeout(this.evaluatehealthTimer);
    this.evaluatehealthTimer = undefined;
    this.evaluatehealthScheduled = false;
    this.evaluatehealthDeadline = Infinity;
  }

  scheduleUpdateTypes() {
    if (this.updateTypesScheduled) {
      return;
    }

    this.updateTypesScheduled = true;

    setTimeout(() => {
      this.updateTypesScheduled = false;
      this.updateTypes();
    }, 1);
  }

  bindModels() {
    // Whenever the node library is modified such that types may be added or removed
    // reset the types of all nodes so that they are re evaluated
    NodeLibrary.instance.on(['typeAdded', 'typeRemoved', 'typeRenamed'], () => this.scheduleUpdateTypes(), this);

    // Globally if a connection is added or removed this can effect inferred port types etc
    // so update types globally
    EventDispatcher.instance.on(
      [
        'Model.connectionAdded',
        'Model.connectionRemoved',
        'Model.portRenamed',
        'Model.parametersChanged',
        'Model.portAdded',
        'Model.portRemoved',
        'Model.instancePortsChanged',
        'Model.portRearranged'
      ],
      () => this.scheduleUpdateTypes(),
      this
    );

    // FIX-007 fix 4. Ports arriving from the running viewer is the event that
    // makes a `con-no-*-port` warning stale, so it is the moment to clear it —
    // not 2 s later, via the lazy pass `scheduleUpdateTypes` above will book.
    //
    // Scoped to this graph's own node (`e.model.owner === this`) so one node's
    // ports do not start a health pass in every other component, and gated on
    // there actually being a warning to clear.
    EventDispatcher.instance.on(
      'Model.instancePortsChanged',
      (e) => {
        const node = e && e.model;
        // A node can have no graph yet — `setDynamicPorts` runs during
        // `ComponentModel.fromJSON` before the owner is assigned (see the same
        // guard in `ViewerConnection`).
        if (!node || node.owner !== this) return;
        if (!this.hasUnresolvedPortWarning(node.id)) return;

        this.scheduleEvaluateHealth({ urgent: true });
      },
      this
    );

    // When a type is renamed, check for port references to that type and update
    NodeLibrary.instance.on(
      ['typeRenamed'],
      (args) => {
        this.forEachNode(function (n) {
          each(n.getPorts(), function (p) {
            // If the node has a reference to that type, update the name
            if (NodeLibrary.nameForPortType(p.type) === 'component' && n.parameters[p.name] === args.oldName) {
              n.parameters[p.name] = args.model.name;
            }
          });
        });

        this.scheduleEvaluateHealth();
      },
      this
    );

    // Must evaluate healths if a new module is registered
    NodeLibrary.instance.on(
      ['moduleRegistered', 'moduleUnregistered', 'libraryUpdated'],
      () => this.scheduleUpdateTypes(),
      this
    );

    // Must update variant
    NodeLibrary.instance.on(
      ['Model.variantAdded', 'Model.variantDeleted', 'Model.variantRenamed'],
      () => this.updateVariantRefs(),
      this
    );
  }

  updateTypes() {
    if (this.owner && this.owner.owner && !NodeLibrary.instance.isModuleRegistered(this.owner.owner)) return; // No need to evaluate if we are not part of a registered module

    this.forEachNode(function (n) {
      n.updateType();
    });

    this.scheduleEvaluateHealth();
  }

  updateVariantRefs() {
    if (this.owner && this.owner.owner && !NodeLibrary.instance.isModuleRegistered(this.owner.owner)) return; // No need to evaluate if we are not part of a registered module

    this.forEachNode(function (n) {
      n.updateVariantRef();
    });

    this.scheduleEvaluateHealth();
  }

  // When a node instance of a certain type is used the type is bound; if port
  // names are changed both connections and parameters must be updated.
  //
  // A graph contains nodes of many types, so every distinct type stays bound
  // (DEBT-004). The previous single `typeModel` slot meant each bind evicted
  // the last one — whichever node type resolved most recently was the only one
  // whose port renames propagated, which is why renaming a component port
  // silently broke existing instance wirings.
  bindTypeModel(type) {
    const _this = this;

    if (!type) return;
    if (this.boundTypeModels.has(type)) return;
    this.boundTypeModels.add(type);

    type.on(
      'portRenamed',
      function (args) {
        // Rename all parameters for all nodes referencing
        // the component
        const oldName = args.oldName;
        const newName = args.port.name;
        const type = args.model;
        _this.forEachNode(function (n) {
          if (n.type === type) {
            n.parameters[newName] = n.parameters[oldName];
            delete n.parameters[oldName];
          }
        });

        // Loop over all connections in graph
        for (const j in _this.connections) {
          const c = _this.connections[j];

          // This connection is connected to a property of the
          // name that is being changed
          if (c.fromProperty === args.oldName) {
            const fromNode = _this.findNodeWithId(c.fromId);

            if (fromNode.type === type) c.fromProperty = args.port.name;
          }

          if (c.toProperty === args.oldName) {
            const toNode = _this.findNodeWithId(c.toId);

            if (toNode.type === type) c.toProperty = args.port.name;
          }
        }
      },
      this
    );
  }

  rekeyAllIds() {
    const map = {};

    this.nodeMap.clear();

    const rekeyNodes = (nodes) => {
      nodes !== undefined &&
        nodes.forEach((n) => {
          const newId = guid();
          map[n.id] = newId;
          n.id = newId;
          this.nodeMap.set(n.id, n);

          rekeyNodes(n.children);
        });
    };

    rekeyNodes(this.roots);

    this.connections.forEach((con) => {
      con.fromId = map[con.fromId];
      con.toId = map[con.toId];
    });
  }

  /**
   * Re-point every reference to `oldPathPrefix` at `newPathPrefix`.
   *
   * A graph refers to a component in two different ways, and both have to move:
   *
   *  - **As a parameter value** — a `component`-typed port, e.g. a Router's
   *    page. This is what the method originally handled.
   *  - **As a node's type** — a component *instance*, where the reference lives
   *    in `node.typename`. This was missed, so renaming a component on import
   *    left instances of it pointing at the old name. That is worse than a
   *    dangling reference when the old name still exists in the target (the
   *    usual reason to rename rather than overwrite): the instance silently
   *    binds to the target's unrelated component of that name. LIB-005 Success
   *    Criterion 3, found by `tests/project/projectimportapply.js`.
   */
  rerouteComponentRefs(oldPathPrefix, newPathPrefix) {
    const reroute = (path: string) => newPathPrefix + path.substring(oldPathPrefix.length);

    this.forEachNode((n) => {
      // Component instances carry the reference in their type name.
      if (typeof n.typename === 'string' && n.typename.startsWith(oldPathPrefix)) {
        // `type` is memoised off `typename`, so this goes through `retypeTo`,
        // which drops the cache and lets it re-resolve against the new name.
        n.retypeTo(reroute(n.typename));
      }

      n.getPorts().forEach((p) => {
        // A `component`-typed port with no value is legal — guard before
        // reaching for `startsWith` on it.
        const value = n.parameters[p.name];
        if (NodeLibrary.nameForPortType(p.type) === 'component' && typeof value === 'string' && value.startsWith(oldPathPrefix)) {
          n.parameters[p.name] = reroute(value);
        }
      });
    });
  }

  getRoots() {
    return this.roots;
  }

  addRoot(model: TSFixme, args?) {
    const _this = this;

    // Make sure the graph listens to type changes for all types in the sub tree that is added
    model.forEach((m) => {
      this.bindTypeModel(m.type);
      m.owner = this;
      this.nodeMap.set(m.id, m);
    });

    this.roots.push(model);
    this.nodeMap.set(model.id, model);
    this.notifyListeners('nodeAdded', { model: model, disableSelect: args?.disableSelect });

    // Support for undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: args.label,
        do: function () {
          _this.addRoot(model);
        },
        undo: function () {
          _this.removeNode(model);
        }
      });
    }
  }

  removeNode(model, args?) {
    const _this = this;

    // Start by removing all connections to/from this node
    this.removeConnectionsForNode(model, args);

    // When the node is free, remove the node
    const parent = model.parent;
    const index = parent ? parent.children.indexOf(model) : 0;
    if (model.parent) {
      const idx = model.parent.children.indexOf(model);
      if (idx !== -1) {
        model.parent.children.splice(idx, 1);
        model.parent = undefined;
        this.nodeMap.delete(model.id);
        model.forEach((child) => {
          this.nodeMap.delete(child.id);
        });
        this.notifyListeners('nodeRemoved', { model: model });
      }
    } else {
      const idx = this.roots.indexOf(model);
      if (idx !== -1) {
        this.roots.splice(idx, 1);
        this.nodeMap.delete(model.id);
        model.forEach((child) => {
          this.nodeMap.delete(child.id);
        });

        this.notifyListeners('nodeRemoved', { model: model });
      }
    }

    this.owner && WarningsModel.instance.clearWarningsForRef({ component: this.owner, node: model });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: args.label,
        do: function () {
          _this.removeNode(model);
        },
        undo: function () {
          if (parent) parent.insertChild(model, index);
          else _this.addRoot(model);
        }
      });
    }
  }

  removeAllNodes(args) {
    while (this.roots.length > 0) {
      this.removeNode(this.roots[0], args);
    }
  }

  removeConnectionsForNode(model, args) {
    // Remove all connections to and from this node
    for (let i = 0; i < this.connections.length; i++) {
      const con = this.connections[i];
      if (con.fromId === model.id || con.toId === model.id) {
        this.removeConnection(con, args);
        i--;
      }
    }

    // Recurse to children
    for (const i in model.children) {
      this.removeConnectionsForNode(model.children[i], args);
    }
  }

  addConnection(model, args?) {
    const _this = this;

    this.connections.push(model);
    this.notifyListeners('connectionAdded', { model: model });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: args.label,
        do: function () {
          _this.addConnection(model);
        },
        undo: function () {
          _this.removeConnection(model);
        }
      });
    }
  }

  removeConnection(model, args?) {
    const _this = this;

    const idx = this.connections.indexOf(model);
    if (idx !== -1) {
      this.connections.splice(idx, 1);
      this.notifyListeners('connectionRemoved', { model: model });

      this.owner && WarningsModel.instance.clearWarningsForRef({ component: this.owner, connection: model });

      // Undo
      if (args && args.undo) {
        const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

        undo.push({
          label: args.label,
          do: function () {
            _this.removeConnection(model);
          },
          undo: function () {
            _this.addConnection(model);
          }
        });
      }
    }
  }

  /**
   * Change a connection's own fields — its label and where that label sits
   * (CAN-001/CAN-002). The third connection verb, beside add and remove.
   *
   * A change to `undefined` **deletes** the key rather than storing it: an
   * empty label has to be indistinguishable from never having had one, or
   * every wire that was ever clicked accumulates a dead key in `project.json`.
   */
  updateConnection(model: Connection, changes: Partial<Connection>, args?: TSFixme) {
    const _this = this;
    const keys = Object.keys(changes) as (keyof Connection)[];

    const previous: Partial<Connection> = {};
    for (const key of keys) previous[key] = model[key] as never;

    function apply(values: Partial<Connection>) {
      for (const key of Object.keys(values) as (keyof Connection)[]) {
        if (values[key] === undefined) delete model[key];
        else (model[key] as unknown) = values[key];
      }
      _this.notifyListeners('connectionUpdated', { model });
    }

    apply(changes);

    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: args.label,
        do: function () {
          apply(changes);
        },
        undo: function () {
          apply(previous);
        }
      });
    }
  }

  /**
   * Whether a wire may be drawn, and — since SIG-001 — *what kind* of refusal it
   * is when it may not.
   *
   * The explicit return type is load-bearing rather than decorative: without it
   * TypeScript infers the union of the three literal objects below, and
   * `WorkflowGraphModel`, which overrides this and returns refusals of its own,
   * stops being assignable to its own base class the moment either side grows a
   * field the other lacks. It did, immediately.
   *
   * `reason` is a plain `string` here on purpose. The narrow union lives in the
   * connection popup (`portCopy.ts`), which is the only reader that has to
   * decide what to *say* about each kind; a model has no business importing a
   * view's vocabulary, and the popup normalises anything it does not recognise
   * to `'other'` — which it renders as "refused, and I am not going to guess
   * why". That is the honest answer for a subclass this file has never seen.
   */
  getConnectionStatus(args): { connectable: boolean; reason?: string; message?: string } {
    const _this = this;
    const targetNode = args.targetNode;
    const targetPort = targetNode.getPort(args.targetPort);
    const sourceNode = args.sourceNode;
    const sourcePort = sourceNode.getPort(args.sourcePort);

    // Make sure types are compatible
    if (sourcePort && targetPort) {
      const typesCompatible = NodeLibrary.instance.canCastPortTypes(sourcePort.type, targetPort.type);

      if (!typesCompatible) {
        return {
          connectable: false,
          // SIG-001: the *category* of the refusal, alongside the prose. The
          // connection popup used to throw both away — it dropped every refused
          // port from the list one loop after writing this message — and now
          // renders the row, which means it has to say which kind of refusal it
          // was in a sentence a beginner can act on. It cannot recover that from
          // the string without parsing English.
          reason: 'type-mismatch',
          message:
            'Type mismatch a source port of type <strong>' +
            NodeLibrary.nameForPortType(sourcePort.type) +
            '</strong> cannot be connected to a target port with type <strong>' +
            NodeLibrary.nameForPortType(targetPort.type) +
            '</strong>.'
        };
      }
    }

    // Duplicate connection
    if (sourcePort && targetPort && sourceNode && sourcePort) {
      // TODO: Change "some" to JS equivalent
      const isDuplicate = !!some(this.connections, function (c) {
        return (
          c.toId === targetNode.id &&
          c.toProperty === targetPort.name &&
          c.fromId === sourceNode.id &&
          c.fromProperty === sourcePort.name
        );
      });
      if (isDuplicate) {
        return {
          connectable: false,
          reason: 'duplicate',
          message: 'These ports are already connected in this direction'
        };
      }
    }

    return {
      connectable: true
    };
  }

  getConnectionHealth(c) {
    const sourceId = c.sourceId ? c.sourceId : c.sourceNode.id;
    const targetId = c.targetId ? c.targetId : c.targetNode.id;

    const warnings = WarningsModel.instance.getWarnings({
      component: this.owner,
      connection: {
        fromId: sourceId,
        fromProperty: c.sourcePort,
        toId: targetId,
        toProperty: c.targetPort
      }
    });

    if (warnings) {
      return { healthy: false, message: warnings.shortMessage };
    }

    return { healthy: true };
  }

  /**
   * @param options.urgent run in ~50 ms instead of ~2 s. See
   * `URGENT_EVALUATE_HEALTH_DEBOUNCE_MS` for when that is worth the extra pass.
   */
  scheduleEvaluateHealth(options?: { urgent?: boolean }) {
    const _this = this;
    const delay = options && options.urgent ? URGENT_EVALUATE_HEALTH_DEBOUNCE_MS : EVALUATE_HEALTH_DEBOUNCE_MS;
    const deadline = Date.now() + delay;

    // A pass already landing at or before this one covers it. Comparing
    // deadlines rather than just "is one scheduled" is what lets an urgent
    // request pre-empt a lazy one — and what stops a lazy request from
    // *delaying* an urgent one already in flight.
    if (this.evaluatehealthScheduled && this.evaluatehealthDeadline <= deadline) return;

    if (this.evaluatehealthTimer !== undefined) clearTimeout(this.evaluatehealthTimer);

    this.evaluatehealthScheduled = true;
    this.evaluatehealthDeadline = deadline;

    this.evaluatehealthTimer = setTimeout(function () {
      _this.evaluatehealthTimer = undefined;
      _this.evaluatehealthDeadline = Infinity;
      _this.evaluatehealthScheduled && _this.evaluateHealth();
      _this.evaluatehealthScheduled = false;
    }, delay);
  }

  /**
   * Does any wire touching this node currently carry a warning that the node's
   * ports arriving could clear?
   *
   * The gate on the urgent lane. Cheap — one pass over this graph's own
   * connections, and `getWarnings` is a two-level object lookup — and it keeps
   * the fast pass off the common path, where a viewer pushing ports for a
   * hundred healthy nodes during load would otherwise schedule a hundred
   * graph-wide health passes at 50 ms instead of coalescing into one at 2 s.
   */
  hasUnresolvedPortWarning(nodeId: string): boolean {
    if (!this.owner) return false;

    return this.connections.some((c) => {
      if (c.fromId !== nodeId && c.toId !== nodeId) return false;

      const w = WarningsModel.instance.getWarnings({ component: this.owner, connection: c });
      if (!w) return false;

      // Entries are `{ ref, warning }`; the warning's key lives on the ref.
      return w.warnings.some((entry) => UNRESOLVED_PORT_WARNING_KEYS.indexOf(entry.ref.key) !== -1);
    });
  }

  evaluateHealth() {
    const _this = this;
    if (!NodeLibrary.instance.isLoaded()) return;
    if (!this.owner) return;
    if (!this.owner.owner) return;

    if (!NodeLibrary.instance.isModuleRegistered(this.owner.owner)) return; // This module is not registered in the node library, no need to eval health

    // Nodes
    this.forEachNode(function (n) {
      n.evaluateHealth();
    });

    // Connections
    this.forEachConnection(function (c) {
      _this.evaluateConnectionHealth(c);
    });
  }

  evaluateConnectionHealth(c) {
    if (!this.owner) return; // Not in component

    const sourceNode = this.findNodeWithId(c.fromId);
    const targetNode = this.findNodeWithId(c.toId);

    // Make sure the source and target ports exist
    const sourcePort = sourceNode && c.fromProperty ? sourceNode.getPort(c.fromProperty) : undefined;
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-no-source-port' },
      !sourcePort
        ? {
            message: "Source port doesn't exist.",
            showGlobally: true,
            level: 'error'
          }
        : undefined
    );

    const targetPort = targetNode && c.toProperty ? targetNode.getPort(c.toProperty) : undefined;
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-no-target-port' },
      !targetPort || !NodeLibrary.instance.isConditionalPortValid(targetNode, c.toProperty, ['extended'])
        ? {
            message: "Target port doesn't exist.",
            showGlobally: true,
            level: 'error'
          }
        : undefined
    );

    /**
     * FB-021 — the wire into a port that is SWITCHED OFF rather than missing.
     *
     * Richard: *"maybe make it dotted for a port that can't work? That's what happens when a
     * port is deleted at the moment and the connector is still there."* The precedent he is
     * remembering is the statement directly above, and this is the case it excludes.
     *
     * 🔴 **The `['extended']` scope above is the whole gap.** `portConnectivity.ts` spells the
     * two apart: `extended` means *"not on the node at all"*, while an unnamed group — which
     * `nodelibraryexport.ts:146` defaults to `conditionalports/basic` — *"only suppresses the
     * property row; the port still exists and a wire to it stays valid."* So a `basic`-gated
     * port is live, accepts the wire, delivers the value, and the consumer then ignores it:
     * **328 input ports on the shipped catalog are in that state**, against 21 `extended` ones.
     * `modelProxy` hid the row and this function left the wire solid — one defect, two surfaces.
     *
     * ⚠️ `level: 'warning'`, ruled by Richard, and it is not a hedge: the wire is *valid* and
     * its value is *ignored*, which is a different thing from the deleted port above. Red keeps
     * meaning "this cannot work at all". The dash comes free either way — `getConnectionHealth`
     * turns any unhealthy verdict into `setLineDash([5])` in every paint path, which is why
     * this deliberately adds **no fourth dash pattern** to the three `restoreWireDash` already
     * warns are barely distinguishable.
     *
     * ✅ **Nothing new has to trigger this, and that is measured rather than assumed.**
     * `setParameter` → `notifyListeners('parametersChanged')` → `model.js:76`'s global bridge
     * → `Model.parametersChanged` (bound in `bindModels`) → `scheduleUpdateTypes` → 1 ms →
     * `updateTypes` → `scheduleEvaluateHealth` → this function, 2 s later. So flipping the
     * control that gates the port re-evaluates the wire on the path that already exists, and
     * FB-022's 13-writes-per-60px-drag is coalesced by the debounce that is already there.
     *
     * 🔴 A prior session recorded the opposite — *"nothing re-evaluates health on a parameter
     * change"* — from `grep parameterChanged`, which **misses `parametersChanged`**. The
     * conclusion that followed (a new trigger, guarded against the hot path) would have been a
     * second scheduler racing the first. **A bounded query reports its bound.**
     *
     * ⚠️ Deliberately NOT added to `UNRESOLVED_PORT_WARNING_KEYS`. That list is what *ports
     * arriving* can clear, and it arms FIX-007's 50 ms urgent lane; this warning is cleared by
     * a parameter, on the lazy lane above, and putting it there would fire the fast path for a
     * condition `instancePortsChanged` cannot change.
     */
    const gatedReason =
      targetPort && targetNode && !NodeLibrary.instance.isConditionalPortValid(targetNode, c.toProperty, ['basic'])
        ? reasonsForGatedPorts(targetNode.type && targetNode.type.dynamicports, [c.toProperty], targetNode.getPorts())
            .get(c.toProperty)
        : undefined;
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-target-port-gated' },
      gatedReason
        ? {
            /*
             * One explanation, from the module that already owns it. `portGateReason` narrates
             * the same declaration the property row narrates, so the wire and the panel cannot
             * drift into two different accounts of why the port is off — and a port whose
             * condition that module refuses to put words to raises nothing here either, which
             * is BCN-010's rule: a mark with no reason reads as "broken", not as "switched off".
             */
            message:
              'This wire is delivering a value the node ignores: <strong>' +
              gatedReason.gateLabel +
              '</strong> has switched this port off. ' +
              gatedReason.sentence,
            showGlobally: true,
            level: 'warning'
          }
        : undefined
    );

    // Make sure the ports are connected internally
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-no-source-port-type' },
      sourcePort && !sourcePort.type
        ? {
            message: 'The source port is missing type.',
            level: 'error'
          }
        : undefined
    );

    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-no-target-port-type' },
      targetPort && !targetPort.type
        ? {
            message: 'The target port is missing type.',
            level: 'error'
          }
        : undefined
    );

    // Make sure target and source ports have the same type
    const w =
      targetNode &&
      targetPort &&
      sourceNode &&
      sourcePort &&
      sourcePort.type &&
      targetPort.type &&
      !NodeLibrary.instance.canCastPortTypes(sourcePort.type, targetPort.type);
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-type-mismatch' },
      w
        ? {
            message:
              'Target port of type <strong>' +
              NodeLibrary.nameForPortType(targetPort.type) +
              '</strong> cannot be connected to a source port of type <strong>' +
              NodeLibrary.nameForPortType(sourcePort.type) +
              '</strong>',
            level: 'error'
          }
        : undefined
    );

    /**
     * FIX-025 — the wire the table ALLOWS and the runtime does not convert.
     *
     * The mismatch warning above only fires when `canCastPortTypes` says no. Richard's report
     * is the case where it says yes and the value still arrives wrong: a string wired into a
     * `number` input on a Visual Function, which the runtime stores verbatim. See
     * `connectionCoercion.ts` for why this is a `warning` and not an error, and why it is
     * deliberately narrow.
     */
    const coercion =
      targetPort && sourcePort ? unconvertedCast(sourcePort.type as never, targetPort.type as never) : null;
    WarningsModel.instance.setWarning(
      { component: this.owner, connection: c, key: 'con-type-unconverted' },
      coercion
        ? {
            message:
              'This connects a <strong>' +
              coercion.from +
              '</strong> to a <strong>' +
              coercion.to +
              '</strong> port, and ' +
              coercion.consequence +
              '.',
            level: 'warning'
          }
        : undefined
    );
  }

  // Detaches a node from its parent
  detachNode(node, args?) {
    const _this = this;

    const idx = node.parent.children.indexOf(node);
    const parent = node.parent;
    if (idx !== -1) {
      node.parent.children.splice(idx, 1);
      node.parent = undefined;
      this.roots.push(node);
      this.notifyListeners('nodeDetached', { model: node });

      // Undo
      if (args && args.undo) {
        const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

        undo.push({
          label: args.label,
          do: function () {
            _this.detachNode(node);
          },
          undo: function () {
            _this.attachNode(parent, node, idx);
          }
        });
      }
    }
  }

  // Attaches a node to a parent node at a given index
  attachNode(parent, child, index, args?) {
    const _this = this;

    const idx = this.roots.indexOf(child);
    if (idx !== -1) {
      this.roots.splice(idx, 1);
      child.parent = parent;
      parent.children.splice(index, 0, child);
      this.notifyListeners('nodeAttached', { parent, model: child, index: index });

      // Undo
      if (args && args.undo) {
        const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

        undo.push({
          label: args.label,
          do: function () {
            _this.attachNode(parent, child, index);
          },
          undo: function () {
            _this.detachNode(child);
          }
        });
      }
    }
  }

  // Loop over all nodes (roots and children) of the graph
  forEachNode(callback: (node: NodeGraphNode) => boolean | void): boolean {
    for (const i in this.roots) {
      if (this.roots[i].forEach(callback)) {
        return true;
      }
    }

    return false;
  }

  forEachNodeRecursive(callback: (node: NodeGraphNode) => boolean | void): boolean {
    for (const i in this.roots) {
      if (this.roots[i].forEachRecursive(callback)) {
        return true;
      }
    }

    return false;
  }

  // Loop over all connections of the graph
  forEachConnection(callback: (connection: Connection) => void) {
    for (const i in this.connections) {
      callback(this.connections[i]);
    }
  }

  // Check if the graph has nodes with the specific type
  hasNodesWithType(type) {
    let res = false;
    this.forEachNode(function (n) {
      if (type === n.type) {
        res = true;
        return true;
      }
    });
    return res;
  }

  // Find a node with the specified id
  findNodeWithId(id: string) {
    return this.nodeMap.get(id);
  }

  // Return a set of nodes (only the roots that span the specified list of nodes)
  // and internal connections
  getNodeSetWithNodes(nodes) {
    // Generate ID map
    const idMap = {};

    const set = [];
    for (var i in nodes) {
      const n = nodes[i];
      // Only include nodes that are either root nodes or
      // where the parent is not part of the nodes to be included (in this case the node will be included as child)
      if (n.parent === undefined || nodes.indexOf(n.parent) === -1) {
        n.forEach(function (node) {
          idMap[node.id] = true;
        });
        set.push(n);
      }
    }

    // Get all connections that are within the node group
    const connections = [];
    for (var i in this.connections) {
      const c = this.connections[i];
      if (idMap[c.fromId] && idMap[c.toId]) {
        connections.push(c);
      }
    }

    return new NodeGraphNodeSet({ nodes: set, connections: connections });
  }

  // Insert a node set (roots and connections)
  insertNodeSet(nodeset, args) {
    // Add root nodes and children
    for (var i in nodeset.nodes) {
      const n = nodeset.nodes[i];
      this.addRoot(n, args);
    }

    // Add connections
    for (var i in nodeset.connections) {
      const c = nodeset.connections[i];
      this.addConnection(c, args);
    }

    //add comments
    for (const comment of nodeset.comments) {
      this.commentsModel.addComment(comment, args);
    }
  }

  // Remove all nodes and comments in a node set
  // NOTE: This will also remove all connections between any node in the node set and other nodes
  removeNodeSet(nodeset, args) {
    nodeset.parents = [];

    // Simply remove all roots, connections and children will follow
    for (const i in nodeset.nodes) {
      const n = nodeset.nodes[i];

      this.removeNode(n, args);
    }

    for (const comment of nodeset.comments) {
      this.commentsModel.removeComment(comment.id, args);
    }
  }

  getVisualRootIds() {
    return this.roots.filter((root) => root.type.allowAsChild).map((x) => x.id);
  }

  toJSON(): NodeGraphModelJson {
    const json = {
      connections: this.connections,
      roots: this.roots.map((x) => x.toJSON()),
      // Add all the visual nodes to another list,
      // so when we export the project we have all the data we need.
      visualRoots: this.getVisualRootIds(),
      comments: undefined
    };

    const comments = this.commentsModel.getComments();
    if (comments.length) {
      json.comments = comments;
    }

    return json;
  }
}
