/**
 * A real graph, not a bag of bound methods.
 *
 * Half of the NDA-001 corpus cannot be observed on an isolated node: `States` coalesces
 * *inside* an update pass, `Run Tasks` drives a second component by string, and Richard's
 * null→non-null report is about what one node sees of another's output. Those need a
 * `GraphModel` imported from editor data, a `NodeScope` per component, and
 * `NodeContext.updateDirtyNodes()` as the frame boundary — which is exactly what
 * `nodescope.test.js` and `nodes/componentinstance.test.js` already stand up by hand.
 *
 * This is that setup, named once. It is deliberately in `test/corpus/` rather than
 * `test/helpers/`: `helpers/node-harness.ts` is the *single node* case and stays the right
 * tool for R1–R7 and E1–E4.
 */

import type { NodeInstance, NodeModule, NodeDefinitionOptions } from '@noodl/types';

import type { RuntimeNode } from '../../src/internal';

import GraphModel = require('../../src/models/graphmodel');
import NodeContext = require('../../src/nodecontext');
import NodeDefinition = require('../../src/nodedefinition');

/** A node as the corpus holds it: the definition's surface plus the graph-facing members. */
export type CorpusNode<I extends NodeInstance = NodeInstance> = I & RuntimeNode;

/** One `sendWarning` call, flattened to the fields a test asserts on. */
export interface RecordedWarning {
  component: string;
  nodeId: string;
  key: string;
  message?: string;
}

/**
 * The editor-side channel, recorded.
 *
 * Nodes route every diagnosis they *can* report through `editorConnection.sendWarning`
 * (defect class B: there is nowhere else to put it), so "does this node say anything when
 * it fails" is answerable only by watching this object.
 */
export interface RecordingEditorConnection {
  warnings: RecordedWarning[];
  cleared: Array<{ nodeId: string; key: string }>;
  sendWarning(component: string, nodeId: string, key: string, warning?: { message?: string }): void;
  clearWarning(component: string, nodeId: string, key: string): void;
  sendDynamicPorts(...args: unknown[]): void;
  hasWarningFor(nodeId: string): boolean;
  /**
   * `false`, always. `NodeContext.connectionSentValue` asks this before serialising every
   * value that crosses a wire; a corpus test wants the graph, not the debugger traffic.
   */
  isConnected(): boolean;
  on(): void;
  off(): void;
  [extra: string]: unknown;
}

export function createRecordingEditorConnection(): RecordingEditorConnection {
  const connection: RecordingEditorConnection = {
    warnings: [],
    cleared: [],
    sendWarning(component, nodeId, key, warning) {
      connection.warnings.push({ component, nodeId, key, message: warning && warning.message });
    },
    clearWarning(component, nodeId, key) {
      connection.cleared.push({ nodeId, key });
      for (let i = connection.warnings.length - 1; i >= 0; i--) {
        if (connection.warnings[i].nodeId === nodeId && connection.warnings[i].key === key) {
          connection.warnings.splice(i, 1);
        }
      }
    },
    sendDynamicPorts() {
      /* the editor draws ports; a test only needs the call not to throw */
    },
    hasWarningFor(nodeId) {
      return connection.warnings.some((w) => w.nodeId === nodeId);
    },
    isConnected() {
      return false;
    },
    on() {
      /* NodeContext subscribes to inspector events; nothing here emits them */
    },
    off() {
      /* symmetry with `on` */
    }
  };
  return connection;
}

/** What `GraphModel.importEditorData` accepts, as far as the corpus needs it. */
export type GraphExportData = Parameters<InstanceType<typeof GraphModel>['importEditorData']>[0];

export interface CorpusGraph {
  context: InstanceType<typeof NodeContext>;
  graphModel: InstanceType<typeof GraphModel>;
  /** The root component instance node. */
  root: CorpusNode;
  editorConnection: RecordingEditorConnection;

  /** A node in the root component's scope, by the id it was given in the export data. */
  node<I extends NodeInstance = NodeInstance>(id: string): CorpusNode<I>;

  /** Signal names sent by `id`, in order. Live — assert on it directly. */
  signalsFor(id: string): string[];

  /** One frame: drain the dirty list and every after-update callback. */
  update(): void;

  /**
   * One frame *with a clock*: advances `context.currentFrameTime` by `dt` milliseconds and
   * runs `context.update()`, which is what pumps `timerScheduler`.
   *
   * The viewer's animation frame loop normally owns that clock. Anything driven by a
   * transition — `States`' `reached-<state>` outputs are the corpus's case — is unreachable
   * without it, and would otherwise read as "the signal never fires" when the truth is
   * "nothing ever asked for a frame".
   */
  frame(dt?: number): void;

  /** Frames until nothing is left pending, with a bound so a render loop still fails. */
  settle(frames?: number): Promise<void>;
}

export interface CorpusGraphOptions {
  modules?: Array<NodeModule | NodeDefinitionOptions>;
  data: GraphExportData;
  /** The component instantiated as the root. Defaults to the first one in `data`. */
  rootComponent?: string;
}

function definitionOf(entry: NodeModule | NodeDefinitionOptions): NodeDefinitionOptions {
  return (entry as NodeModule).node ? (entry as NodeModule).node : (entry as NodeDefinitionOptions);
}

export async function createCorpusGraph(options: CorpusGraphOptions): Promise<CorpusGraph> {
  const editorConnection = createRecordingEditorConnection();
  const graphModel = new GraphModel();

  const context = new NodeContext({
    graphModel,
    editorConnection,
    platform: {
      requestUpdate(callback: () => void) {
        // Nothing drives frames in a test; `update()`/`settle()` are the frame boundary.
        void callback;
      },
      getCurrentTime() {
        return Date.now();
      },
      objectToString(object: unknown) {
        return JSON.stringify(object);
      }
    }
  });

  for (const entry of options.modules || []) {
    context.nodeRegister.register(NodeDefinition.defineNode(definitionOf(entry)));
  }

  const signals: Record<string, string[]> = {};

  // Every node instance records its own signals as it is created, so a test never has to
  // reach a node before the frame in which it fires.
  const originalCreate = context.nodeRegister.createNode.bind(context.nodeRegister);
  context.nodeRegister.createNode = function (name: string, id: string, extraProps?: unknown) {
    const node = originalCreate(name, id, extraProps) as unknown as RuntimeNode;
    const recorded = signals[id] || (signals[id] = []);
    const original = node.sendSignalOnOutput.bind(node);
    node.sendSignalOnOutput = (outputName: string) => {
      recorded.push(outputName);
      original(outputName);
    };
    return node as never;
  } as typeof context.nodeRegister.createNode;

  graphModel.on('componentAdded', (component: unknown) => context.registerComponentModel(component));
  await graphModel.importEditorData(options.data);

  const rootName = options.rootComponent || (options.data as { components: Array<{ name: string }> }).components[0].name;
  const root = (await context.createComponentInstanceNode(
    rootName,
    'corpus-root',
    undefined
  )) as unknown as CorpusNode;
  context.setRootComponent(root);

  const graph: CorpusGraph = {
    context,
    graphModel,
    root,
    editorConnection,

    node<I extends NodeInstance = NodeInstance>(id: string): CorpusNode<I> {
      const found = root.nodeScope.getNodesWithIdRecursive(id);
      if (!found || found.length === 0) throw new Error('No node with id ' + id + ' in the graph');
      return found[0] as unknown as CorpusNode<I>;
    },

    signalsFor(id: string): string[] {
      return signals[id] || (signals[id] = []);
    },

    update() {
      context.updateDirtyNodes();
    },

    frame(dt = 16) {
      context.currentFrameTime += dt;
      context.update();
    },

    async settle(frames = 10) {
      for (let i = 0; i < frames; i++) {
        context.updateDirtyNodes();
        // Several nodes here are `async` by construction — `Collection.notify` awaits its
        // listeners, `Run Tasks` awaits component creation. Yielding the microtask queue
        // between frames is what lets those land before the next one.
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  };

  return graph;
}
