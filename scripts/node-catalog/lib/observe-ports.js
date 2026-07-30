/**
 * SUB-013 §1 — observe a node's dynamic ports instead of parsing for them.
 *
 * The catalog's founding rule (SCHEMA.md, SUB-004) is that everything in it comes from loading
 * the real registries headlessly, never from reading node sources, so it cannot drift. Parameter
 * encodings have to be extracted the same way or they inherit none of that guarantee.
 *
 * A node's dynamic ports are emitted by its *module* `setup(context, graphModel)` hook, which
 * subscribes to graph events and calls `editorConnection.sendDynamicPorts(nodeId, ports)` when a
 * node of its type appears or has a parameter changed. So the observation is: stand up the
 * smallest graph model and editor connection those hooks will accept, hand them a node model
 * carrying seed parameters, and record the port names that come back.
 *
 * What this deliberately does NOT do is call the node's port-building helper directly. Those are
 * module-private, and testing a helper is not testing that anything calls it — a lesson this
 * repo has now paid for several times. Driving `setup` pins the real path, which is also why
 * `graph-harness` cannot serve here: it never calls a module's `setup` and says so in its own
 * comment.
 */

/** The graph-model events a `setup` hook may gate its work behind, in the order the editor fires them. */
const LIFECYCLE_EVENTS = ['editorImportComplete', 'projectLoaded', 'metadataChanged'];

function makeEmitter() {
  const listeners = new Map();
  return {
    on(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
      return this;
    },
    off() {
      return this;
    },
    removeListenersWithRef() {
      return this;
    },
    emit(name, ...args) {
      // Copy first: several setups subscribe from inside a handler.
      for (const callback of (listeners.get(name) || []).slice()) callback(...args);
      return this;
    },
    /** Event names anything actually subscribed to — used to decide what is worth firing. */
    subscribed() {
      return [...listeners.keys()];
    }
  };
}

/**
 * A node model as `setup` hooks use one: an emitter with `id`, `type`, `parameters`, and a
 * `component` it belongs to. Nothing here mimics `NodeGraphNode` beyond the surface those hooks
 * touch — a fuller fake would be a second implementation to keep in step, not more truthful.
 */
function makeNodeModel(typeName, parameters, component) {
  const model = makeEmitter();
  return Object.assign(model, {
    id: 'observed-node',
    type: typeName,
    typeName,
    parameters: { ...parameters },
    component,
    getComponent: () => component,
    getVisualParentNode: () => undefined,
    forEachRecursive() {},
    // The Function node writes its signal outputs straight onto the model
    // (`node.outputPorts[name] = port`) so its first script run can find them.
    // Without these the hook throws part-way and emits nothing, which reads
    // exactly like a node that has no encoding.
    inputPorts: {},
    outputPorts: {}
  });
}

function makeComponent(name) {
  const component = makeEmitter();
  return Object.assign(component, {
    name,
    fullName: name,
    inputPorts: {},
    outputPorts: {},
    getNodes: () => [],
    getNodesWithType: () => [],
    // The numbered-input hook counts the series from parameters *and* connections, so it asks
    // the component what is wired to the node before it can name a single port.
    getConnectionsTo: () => [],
    getConnectionsFrom: () => [],
    forEachNode() {}
  });
}

/**
 * Stand up the fake editor connection + graph model, run `setup`, and return every
 * `sendDynamicPorts` emission for the observed node.
 *
 * @param {string} typeName
 * @param {object} rawDef      the node definition as passed to `registerNode`
 * @param {object} parameters  seed parameters for the observed node
 * @param {object} [projectMetadata] what `graphModel.getMetaData(key)` should return
 * @returns {{ emissions: Array<{ports: object[], opts: object}>, ports: object[], subscribed: string[] }}
 */
function driveSetup(typeName, rawDef, parameters, projectMetadata = {}) {
  // Two hooks emit dynamic ports and only one of them is called `setup`. Nodes that declare
  // `numberedInputs` never write a hook — `nodedefinition.ts` fits them with
  // `setupNumberedInputDynamicPorts`, and a harness that drove only `setup` would report that
  // whole family as having no observable encoding.
  //
  // They are driven in separate passes and unioned rather than together, because within one hook
  // a later emission *replaces* the earlier one (`sendDynamicPorts` is a whole-list send) while
  // across hooks the two lists are additive. Taking the last emission overall would silently drop
  // whichever hook happened to run first.
  const hookNames = ['setup', 'setupNumberedInputDynamicPorts'].filter(
    (name) => rawDef && typeof rawDef[name] === 'function'
  );
  if (!hookNames.length) return { emissions: [], ports: [], subscribed: [], noSetup: true };

  const passes = hookNames.map((name) => drivePass(typeName, rawDef[name], parameters, projectMetadata));

  const ports = [];
  const seen = new Set();
  for (const pass of passes) {
    for (const port of pass.ports) {
      if (seen.has(port.name)) continue;
      seen.add(port.name);
      ports.push(port);
    }
  }

  return {
    ports,
    emissions: passes.flatMap((p) => p.emissions),
    renamed: passes.map((p) => p.renamed).find(Boolean),
    warnings: passes.flatMap((p) => p.warnings),
    subscribed: passes.flatMap((p) => p.subscribed),
    hooks: hookNames
  };
}

/** One hook, one fake graph, one recorded port list. */
function drivePass(typeName, hook, parameters, projectMetadata) {
  const emissions = [];
  const warnings = [];

  const editorConnection = {
    isRunningLocally: () => true,
    isConnected: () => true,
    sendDynamicPorts(nodeId, ports, opts) {
      emissions.push({ nodeId, ports: ports || [], opts: opts || {} });
    },
    sendWarning(_component, nodeId, key, warning) {
      warnings.push({ nodeId, key, warning });
    },
    clearWarning() {},
    sendNodeSubLabel() {},
    on() {},
    off() {}
  };

  const component = makeComponent('/observed');
  const graphModel = makeEmitter();
  Object.assign(graphModel, {
    getNodesWithType: () => [],
    getComponentWithName: () => undefined,
    getRootComponent: () => component,
    components: [component],
    forEachComponent() {},
    // Project metadata — cloud database schemas, backend services, the DB config. Returning
    // nothing is the honest answer: this harness has no project, so the nodes that key their
    // ports off a class schema legitimately emit nothing and land in the residue (§3). What
    // matters is that they *return* nothing rather than throwing, or a node with no schema
    // would be indistinguishable from a node whose hook crashed.
    getMetaData: (key) => projectMetadata[key],
    setMetaData() {},
    on: graphModel.on
  });

  const context = {
    editorConnection,
    graphModel,
    // Some setups read these off the context before subscribing.
    isRunningLocally: () => true,
    runtimeType: 'browser'
  };

  hook(context, graphModel);

  const node = makeNodeModel(typeName, parameters, component);

  // The editor's real order is: import completes, then nodes are announced, then parameter
  // edits arrive. Fire the lifecycle events both before and after `nodeAdded`, because the
  // hooks disagree about which side of the gate they subscribe on and we are not trying to
  // model that disagreement — only to get past it.
  const fire = (name, ...args) => graphModel.emit(name, ...args);
  const lifecycle = [...LIFECYCLE_EVENTS, ...Object.keys(projectMetadata).map((k) => `metadataChanged.${k}`)];
  for (const event of lifecycle) fire(event);
  fire(`nodeAdded.${typeName}`, node);
  fire('nodeAdded', node);
  for (const event of lifecycle) fire(event);

  // A parameter edit is the other route into the same helper, and for several nodes it is the
  // only route that runs (their `nodeAdded` handler returns early when a seed is absent, which
  // is exactly the state a freshly-placed node is in).
  for (const name of Object.keys(parameters)) {
    node.emit('parameterUpdated', { name, value: parameters[name] });
  }

  const last = emissions.length ? emissions[emissions.length - 1] : undefined;
  return {
    emissions,
    ports: last ? last.ports : [],
    renamed: last && last.opts ? last.opts.renamed : undefined,
    warnings,
    subscribed: graphModel.subscribed()
  };
}

module.exports = { driveSetup, makeEmitter, makeNodeModel, makeComponent };
