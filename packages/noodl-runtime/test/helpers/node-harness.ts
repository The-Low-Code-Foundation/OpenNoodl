/**
 * One typed way to build a node, drive it, and see what it sent.
 *
 * Four suites had each grown their own copy of this — `harness()` in
 * agent-live-endpoint, `createSseNode()` in agent-sse-node, `createNode()` in
 * agent-stream-nodes, `makePair()`/`wire()` in node-signal-value-pairing. All four did
 * the same three things (register a definition, intercept `sendSignalOnOutput` to
 * record signals, read `getOutput(name).value`), and all four reached for `any` to do
 * it, because the published `NodeInstance` type deliberately hides the graph-wiring and
 * lifecycle members a *test* is exactly the code that needs.
 *
 * Those members are not undescribed: `RuntimeNode` in `src/internal.d.ts` has named
 * them since PLAT-003 slice 2. A test just had no reason to know that, so each suite
 * cast its way past them independently — the same shape PLAT-004 has now found in five
 * separate packages.
 *
 * The node-specific methods (`handleFrame`, `addChunk`, …) come from
 * `src/nodes/std-library/agent/node-instances.d.ts`, which names each definition's own
 * surface once. Pass one as the type argument:
 *
 *     const sse = graph.make<SseNodeInstance>('net.noodl.SSE', 'sse-1');
 *     sse.handleFrame({ event: 'message', data: 'hi', id: '1' });   // checked
 *
 * What is deliberately *not* here: the transport doubles (fake fetch, fake
 * EventSource, fake timers). agent-sse-node.test.ts keeps a trimmed copy of
 * agent-sse-connection.test.ts's on purpose — "so the two suites cannot break each
 * other" — and that is a decision about test isolation, not an accident worth
 * collapsing.
 */

import type { NodeInstance, NodeMetadata, NodeModule } from '@noodl/types';

import type { RuntimeNode } from '../../src/internal';

import NodeContext = require('../../src/nodecontext');
import NodeDefinition = require('../../src/nodedefinition');

/**
 * A node as a test holds it: the definition's own surface, plus the runtime members
 * (`connectInput`, `_onNodeDeleted`, a typed `getOutput`) that only the graph normally
 * calls.
 */
export type TestNode<I extends NodeInstance = NodeInstance> = I & RuntimeNode;

/** `NodeContext` instances, as this file builds them. */
export type TestContext = InstanceType<typeof NodeContext>;

export interface TestGraph {
  context: TestContext;

  /**
   * Builds one node and starts recording its signals.
   *
   * @param type the registered node type, e.g. `net.noodl.SSE`
   * @param id   the instance id; also the key under which its signals are recorded
   */
  make<I extends NodeInstance = NodeInstance>(type: string, id: string): TestNode<I>;

  /** Signal names sent by `id`, in order. The array is live — assert on it directly. */
  signalsFor(id: string): string[];

  /**
   * Drives a downstream node from an upstream node's signals, the way a graph
   * connection would.
   *
   * Polling an output value cannot keep up with a token stream, and an unconnected
   * output's cached `.value` is not what the graph would have seen.
   */
  on(id: string, listener: (signal: string) => void): void;

  metadata(type: string): NodeMetadata;
}

/**
 * Registers `modules` in a fresh context.
 *
 * A module is what a node file exports: `{ node: <definition> }`. Modules without a
 * `node` (setup-only ones) are skipped rather than rejected.
 */
export function createGraph(...modules: NodeModule[]): TestGraph {
  const context = new NodeContext();
  for (const module of modules) {
    if (module && module.node) context.nodeRegister.register(NodeDefinition.defineNode(module.node));
  }

  const signals: Record<string, string[]> = {};
  const listeners: Record<string, (signal: string) => void> = {};

  return {
    context,

    make<I extends NodeInstance = NodeInstance>(type: string, id: string): TestNode<I> {
      // The one cast in the file, and the reason it exists: `NodeRegister.createNode`
      // returns the published `NodeInstance`, which is correct for production and too
      // narrow for a test. Which definition `type` names — and so which methods the
      // instance actually has — is knowable only to the caller.
      const node = context.nodeRegister.createNode(type, id) as unknown as TestNode<I>;

      const recorded: string[] = [];
      signals[id] = recorded;

      const original = node.sendSignalOnOutput.bind(node);
      node.sendSignalOnOutput = (name: string) => {
        recorded.push(name);
        original(name);
        const listener = listeners[id];
        if (listener) listener(name);
      };

      return node;
    },

    signalsFor(id: string): string[] {
      return signals[id] || (signals[id] = []);
    },

    on(id: string, listener: (signal: string) => void): void {
      listeners[id] = listener;
    },

    metadata(type: string): NodeMetadata {
      return context.nodeRegister.getNodeMetadata(type);
    }
  };
}

export interface DrivenNode<I extends NodeInstance = NodeInstance> {
  node: TestNode<I>;
  /** Signal names the node sent, in order. Live — assert on it directly. */
  signals: string[];
  /** The current value of an output port. */
  out(name: string): unknown;
  /** Fires an edge-triggered input, resetting the edge first. */
  pulse(name: string): void;
  metadata: NodeMetadata;
  context: TestContext;
  graph: TestGraph;
}

/** The single-node case, which is most of them. */
export function createNode<I extends NodeInstance = NodeInstance>(
  module: NodeModule,
  type: string,
  id: string = type + '-1'
): DrivenNode<I> {
  const graph = createGraph(module);
  const node = graph.make<I>(type, id);

  return {
    node,
    signals: graph.signalsFor(id),
    out: (name: string) => outputValue(node, name),
    pulse: (name: string) => pulse(node, name),
    metadata: graph.metadata(type),
    context: graph.context,
    graph
  };
}

/**
 * The current value of an output port.
 *
 * `NodeInstance.getOutput` is published as returning `OutputPropertyLike`, whose
 * `value` is `unknown` — which is honest, and why every read is followed by a cast or
 * a `String(...)` at the assertion.
 */
export function outputValue(node: NodeInstance, name: string): unknown {
  return node.getOutput(name).value;
}

/**
 * Fires an edge-triggered input.
 *
 * Signal inputs are edge-triggered: `setInputValue(name, true)` twice in a row fires
 * once. Resetting the edge first is what makes a second call do anything.
 */
export function pulse(node: NodeInstance, name: string): void {
  node.setInputValue(name, false);
  node.setInputValue(name, true);
}
