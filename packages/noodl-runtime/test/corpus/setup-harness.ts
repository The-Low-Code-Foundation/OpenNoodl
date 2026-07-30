/**
 * A node module's `setup`, driven against a fake graph model.
 *
 * `graph-harness.ts` never calls `setup` and says so, which means the whole of a node's
 * *editor-time* behaviour — the dynamic ports it publishes, the warnings it raises while the
 * author is wiring, the parameter changes it reacts to — is invisible to the ordinary corpus.
 * NDA-012's Navigation pass found six of its fifteen defects there, so this is not a corner:
 * it is where the defects are.
 *
 * NDA-009, NDA-010 and NDA-012's Navigation file each hand-rolled the same three objects —
 * an `EventEmitter` stub, a `graphModel` with `components`/`getNodesWithType`, and a
 * recording `sendDynamicPorts`. This is that, named once.
 *
 * Deliberately beside `graph-harness.ts` rather than in `test/helpers/`: it is the same
 * *corpus* apparatus, one layer up from a node instance and one layer below a running graph.
 *
 * ```ts
 * const setup = driveSetup({
 *   module: PageInputsModule,
 *   type: 'PageInputs',
 *   nodes: [{ id: 'pi-1', parameters: { pathParams: 'id' } }]
 * });
 * expect(setup.portNames('pi-1')).toContain('pm-id');
 * ```
 */

/** The minimum of `EventEmitter` that a module's `setup` reaches for. */
export interface FakeEmitter {
  on(event: string, cb: (arg?: never) => void): void;
  emit(event: string, arg?: unknown): void;
}

export function emitter(): FakeEmitter {
  const listeners: Record<string, Array<(arg?: never) => void>> = {};
  return {
    on(event, cb) {
      (listeners[event] = listeners[event] || []).push(cb);
    },
    emit(event, arg) {
      // Copied before iterating: several `setup`s subscribe from inside a handler, and a
      // listener added mid-emit must not run in the emit that added it.
      (listeners[event] || []).slice().forEach((cb) => cb(arg as never));
    }
  };
}

/** A port as `sendDynamicPorts` publishes it, flattened to the fields a row asserts on. */
export interface RecordedPort {
  name: string;
  displayName?: string;
  type?: unknown;
  plug?: string;
  group?: string;
  default?: unknown;
  [extra: string]: unknown;
}

/** One `sendDynamicPorts` call. */
export interface RecordedPublish {
  nodeId: string;
  ports: RecordedPort[];
  options?: unknown;
}

/** One `sendWarning` call. */
export interface RecordedSetupWarning {
  component: string;
  nodeId: string;
  key: string;
  message?: string;
}

/** A graph node as the editor's model presents it to a `setup`. */
export interface FakeGraphNode extends FakeEmitter {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  /** The component this node sits in. Only some `setup`s reach for it. */
  component?: { name: string };
  inputPorts?: Record<string, unknown>;
  outputPorts?: Record<string, unknown>;
}

export interface FakeGraphNodeSpec {
  id: string;
  /** Defaults to the harness's `type`. */
  type?: string;
  parameters?: Record<string, unknown>;
  component?: { name: string };
  inputPorts?: Record<string, unknown>;
  outputPorts?: Record<string, unknown>;
}

/** A component as a `setup` sees it: a name and the nodes inside it, by type. */
export interface FakeComponent extends FakeEmitter {
  name: string;
  getNodesWithType(type: string): FakeGraphNode[];
}

export function fakeComponent(name: string, nodesByType: Record<string, FakeGraphNode[]> = {}): FakeComponent {
  return Object.assign(emitter(), {
    name,
    getNodesWithType: (type: string) => nodesByType[type] || []
  });
}

export function fakeGraphNode(spec: FakeGraphNodeSpec, defaultType: string): FakeGraphNode {
  return Object.assign(emitter(), {
    id: spec.id,
    type: spec.type || defaultType,
    parameters: spec.parameters || {},
    component: spec.component,
    inputPorts: spec.inputPorts || {},
    outputPorts: spec.outputPorts || {}
  });
}

/** What a node module looks like from here. Modules are `.ts` and `.js` both, hence the cast. */
export type SetupModule = { setup(context: unknown, graphModel: unknown): void };

export interface DriveSetupOptions {
  /** The module whose `setup` is under test. */
  module: unknown;
  /** The node type this module registers handlers for. */
  type: string;
  /** The graph nodes of that type. */
  nodes?: FakeGraphNodeSpec[];
  /** Other node types present in the graph, for modules that look past their own. */
  otherNodes?: Record<string, FakeGraphNode[]>;
  /** Components by name, for modules that resolve a target component. */
  components?: Record<string, FakeComponent>;
  /**
   * Extra members on the context. `editorConnection` and `isRunningLocally` are supplied;
   * anything else a module reaches for (`modelScope`, `styles`, …) goes here.
   */
  context?: Record<string, unknown>;
  /**
   * Whether to emit `editorImportComplete` after `setup` returns. Default `true`.
   *
   * Several modules subscribe to `nodeAdded.<type>` only from inside that event, so without
   * it they publish nothing at all and the row reads as "the node has no ports" — which is a
   * true statement about the harness, not about the node.
   */
  importComplete?: boolean;
  /**
   * Whether to emit `nodeAdded.<type>` for each node. Default `true`.
   *
   * The other half of the same trap: some modules only ever act from `nodeAdded`, others
   * only from a `getNodesWithType` sweep at import, and a few do both and must not
   * double-publish.
   */
  announceNodes?: boolean;
}

export interface SetupHarness {
  graphModel: FakeEmitter & {
    components: Record<string, FakeComponent>;
    getNodesWithType(type: string): FakeGraphNode[];
  };
  editorConnection: Record<string, unknown>;
  /** Every `sendDynamicPorts`, in order. Live. */
  publishes: RecordedPublish[];
  /** Every `sendWarning`, in order, with cleared keys removed. Live. */
  warnings: RecordedSetupWarning[];
  /** Every `clearWarning`, in order. Live. */
  cleared: Array<{ nodeId: string; key: string }>;
  /** The graph nodes this harness created, by id. */
  nodes: Record<string, FakeGraphNode>;
  /** The single node, when there is exactly one. Throws otherwise. */
  node: FakeGraphNode;
  /** The most recent port publish for a node id (`[]` if it never published). */
  ports(nodeId?: string): RecordedPort[];
  /** The names of {@link ports}, which is what most rows actually assert on. */
  portNames(nodeId?: string): string[];
  /** One published port by name, or `undefined`. */
  port(name: string, nodeId?: string): RecordedPort | undefined;
  /** Change a parameter and raise `parameterUpdated`, as the editor does. */
  setParameter(nodeId: string, name: string, value: unknown): void;
}

/**
 * Run a module's `setup` over a fake graph and record what it publishes.
 *
 * The two `emit`s at the end are the part worth knowing about — see `importComplete` and
 * `announceNodes`. A module that publishes nothing here has usually not been driven, and the
 * fix is a flag rather than a defect report.
 */
export function driveSetup(options: DriveSetupOptions): SetupHarness {
  const publishes: RecordedPublish[] = [];
  const warnings: RecordedSetupWarning[] = [];
  const cleared: Array<{ nodeId: string; key: string }> = [];

  const nodes: Record<string, FakeGraphNode> = {};
  const ownNodes = (options.nodes || []).map((spec) => {
    const node = fakeGraphNode(spec, options.type);
    nodes[node.id] = node;
    return node;
  });

  const editorConnection: Record<string, unknown> = {
    isRunningLocally: () => true,
    isConnected: () => false,
    sendDynamicPorts(nodeId: string, ports: RecordedPort[], opts?: unknown) {
      publishes.push({ nodeId, ports: ports || [], options: opts });
    },
    sendWarning(component: string, nodeId: string, key: string, warning?: { message?: string }) {
      warnings.push({ component, nodeId, key, message: warning && warning.message });
    },
    clearWarning(component: string, nodeId: string, key: string) {
      cleared.push({ nodeId, key });
      for (let i = warnings.length - 1; i >= 0; i--) {
        if (warnings[i].nodeId === nodeId && warnings[i].key === key) warnings.splice(i, 1);
      }
    },
    sendNodeSubLabel() {
      /* CAN-003's node-card label; recorded by `graph-harness`, not needed here */
    }
  };

  const graphModel = Object.assign(emitter(), {
    components: options.components || {},
    getNodesWithType(type: string): FakeGraphNode[] {
      if (type === options.type) return ownNodes;
      return (options.otherNodes && options.otherNodes[type]) || [];
    }
  });

  const context = Object.assign({ editorConnection }, options.context);

  (options.module as SetupModule).setup(context, graphModel);

  if (options.importComplete !== false) graphModel.emit('editorImportComplete');
  if (options.announceNodes !== false) {
    for (const node of ownNodes) graphModel.emit('nodeAdded.' + options.type, node);
  }

  function only(): FakeGraphNode {
    const ids = Object.keys(nodes);
    if (ids.length !== 1) throw new Error('driveSetup: `node` needs exactly one node, got ' + ids.length);
    return nodes[ids[0]];
  }

  function publishesFor(nodeId?: string): RecordedPublish[] {
    const id = nodeId || only().id;
    return publishes.filter((p) => p.nodeId === id);
  }

  const harness: SetupHarness = {
    graphModel,
    editorConnection,
    publishes,
    warnings,
    cleared,
    nodes,
    get node() {
      return only();
    },
    ports(nodeId) {
      const own = publishesFor(nodeId);
      return own.length > 0 ? own[own.length - 1].ports : [];
    },
    portNames(nodeId) {
      return harness.ports(nodeId).map((p) => p.name);
    },
    port(name, nodeId) {
      return harness.ports(nodeId).find((p) => p.name === name);
    },
    setParameter(nodeId, name, value) {
      const node = nodes[nodeId];
      if (!node) throw new Error('driveSetup: no node with id ' + nodeId);
      node.parameters[name] = value;
      node.emit('parameterUpdated', { name, value });
    }
  };

  return harness;
}
