/**
 * NDA-012 (Data) — the AIX-005 "agent" family's audit rows, 15 nodes.
 *
 * Nothing had ever read these fifteen. They are the two largest port counts in the category
 * and the only ones in it that own a socket, a timer or a reconnect policy, so the checks that
 * paid were H1 (survives unmount) and A1 (every mutation path notifies).
 *
 * Four shapes, all driven rather than reasoned about:
 *
 * - **A1/A** three nodes were *inert until an author touched an input*. `registerInput` writes
 *   a port's `default` straight into `_inputValues` (`node.ts:116-117`) and `NodeScope`
 *   queues only the parameters the model actually carries (`nodescope.ts:148-157`), so a
 *   declared `default` never runs its setter. Every node here that does its real work from a
 *   setter's side effect therefore did nothing at all until something was authored.
 * - **A1/B** the SSE node did not follow a `URL` change, and the WebSocket node — whose header
 *   says the two share a port shape "so the two are interchangeable at a glance" — does, with
 *   a comment naming the exact failure SSE has. FINDINGS SR-vi, one file over.
 * - **B1/B3** four nodes ended a signal input on an `error` *string* with no `Failure` signal
 *   and no runtime-error raise, while five siblings in the same directory have both.
 * - **B1** `Pattern Extractor` reported a *blank* pattern as `Not Found`, which its own
 *   docstring forbids in the sentence above the line that does it.
 *
 * ⚠️ The rows drive real node definitions inside a real `NodeContext`, and the signal
 * assertions go **over a wire into a receiver**: a node's own `sendSignalOnOutput` log cannot
 * tell a pulse from a value, which is what hid the `Date To String` defect for two years.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph, type CorpusNode } from './graph-harness';

import GlobalStoreNode = require('../../src/nodes/std-library/agent/globalstorenode');
import SetGlobalStoreNode = require('../../src/nodes/std-library/agent/globalstoresetnode');
import SubscribeToStoreNode = require('../../src/nodes/std-library/agent/globalstoresubscribenode');
import StateHistoryNode = require('../../src/nodes/std-library/agent/statehistorynode');
import UndoNode = require('../../src/nodes/std-library/agent/undonode');
import StateSnapshotNode = require('../../src/nodes/std-library/agent/statesnapshotnode');
import OptimisticUpdateNode = require('../../src/nodes/std-library/agent/optimisticupdatenode');
import TextAccumulatorNode = require('../../src/nodes/std-library/agent/text-accumulator');
import PatternExtractorNode = require('../../src/nodes/std-library/agent/pattern-extractor');
import JsonStreamParserNode = require('../../src/nodes/std-library/agent/json-stream-parser');
import StreamBufferNode = require('../../src/nodes/std-library/agent/stream-buffer');
import ActionHandlerNode = require('../../src/nodes/std-library/agent/actionhandlernode');
import ActionDispatcherNode = require('../../src/nodes/std-library/agent/actiondispatchernode');
import SSENode = require('../../src/nodes/std-library/agent/sse');

import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';
import { stateHistoryManager } from '../../src/nodes/std-library/agent/statehistory';
import { actionRegistry } from '../../src/nodes/std-library/agent/action-dispatcher';
import { extractPattern } from '../../src/nodes/std-library/agent/stream-parsers';

/** Feeds one value at one port of the node under test, the way a connection would. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      },
      go: { type: 'signal' }
    },
    methods: {
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      },
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
  go(): void;
}

/** Counts signals arriving on a wire, which is the only way to see a *pulse* rather than a value. */
const WatcherModule: NodeModule = {
  node: {
    name: 'corpus.Watcher',
    category: 'Corpus',
    initialize(this: NodeInstance) {
      this._internal.pulses = 0;
      this._internal.values = [];
    },
    inputs: {
      pulse: {
        type: 'signal',
        valueChangedToTrue(this: NodeInstance) {
          (this._internal.pulses as number)++;
        }
      },
      value: {
        type: '*',
        set(this: NodeInstance, value: unknown) {
          (this._internal.values as unknown[]).push(value);
        }
      }
    }
  }
};

interface WatcherInstance extends NodeInstance {
  _internal: { pulses: number; values: unknown[] };
}

beforeEach(() => {
  globalStoreManager.reset({ clearState: true });
  stateHistoryManager.reset();
  actionRegistry.reset();
});

afterEach(() => {
  globalStoreManager.reset({ clearState: true });
  stateHistoryManager.reset();
  actionRegistry.reset();
});

/* ================================================================== *
 * A1/A — a declared `default` never runs a setter, so three nodes
 *        did nothing until something was authored
 * ================================================================== */

describe('A1 — the store nodes come alive without an authored parameter', () => {
  /**
   * The whole point of the row is the **empty `parameters`**. Every one of these nodes
   * declares `storeName` with `default: 'app'` and does its real work — configure, subscribe,
   * attach — from that setter's side effect. `NodeScope.setNodeParameters` iterates
   * `Object.keys(nodeModel.parameters)`, so an author who accepts the default writes no
   * parameter and the setter is never called.
   *
   * An author *cannot* see this: the property panel shows `app`, the `State` output reads
   * correctly on its first evaluation (the getter goes to the manager, which mints the store),
   * and only the reactions are missing.
   */
  async function storeGraph(): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [
        TriggerModule,
        WatcherModule,
        GlobalStoreNode as unknown as NodeModule,
        SetGlobalStoreNode as unknown as NodeModule,
        SubscribeToStoreNode as unknown as NodeModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'store', type: 'net.noodl.GlobalStore' },
              // Only the writer is authored, because a writer has to be: a key is required
              // and has no default. The reader and the subscriber accept every default.
              { id: 'set', type: 'net.noodl.GlobalStore.Set', parameters: { key: 'title' } },
              { id: 'subscribe', type: 'net.noodl.GlobalStore.Subscribe' },
              { id: 'changed', type: 'corpus.Watcher' },
              { id: 'stateChanged', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'set', targetPort: 'value' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'set', targetPort: 'set' },
              { sourceId: 'subscribe', sourcePort: 'changed', targetId: 'changed', targetPort: 'pulse' },
              { sourceId: 'store', sourcePort: 'stateChanged', targetId: 'stateChanged', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });
  }

  it('Subscribe to Store fires Changed for a write it never had a parameter for', async () => {
    const graph = await storeGraph();
    await graph.settle(2);

    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send('Hello');
    trigger.go();
    await graph.settle(3);

    expect(globalStoreManager.getKey('app', 'title')).toBe('Hello');
    expect(graph.node<WatcherInstance>('changed')._internal.pulses).toBe(1);
  });

  it('Global Store fires State Changed for the same write', async () => {
    const graph = await storeGraph();
    await graph.settle(2);

    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send('Hello');
    trigger.go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('stateChanged')._internal.pulses).toBe(1);
  });

  it('Global Store fires Ready once, so a graph can sequence off the store existing', async () => {
    const graph = await storeGraph();
    await graph.settle(2);

    expect(graph.signalsFor('store').filter((s) => s === 'ready')).toEqual(['ready']);
  });

  /**
   * The control, and the one that says the fix is not "configure on every frame": the store's
   * `configureStore` is idempotent but `Ready` is not, and a `Ready` per frame would be a
   * worse defect than no `Ready` at all.
   */
  it('does not re-fire Ready on later frames', async () => {
    const graph = await storeGraph();
    await graph.settle(6);

    expect(graph.signalsFor('store').filter((s) => s === 'ready').length).toBe(1);
  });

  it('State History records a change nothing authored a parameter for', async () => {
    const graph = await createCorpusGraph({
      modules: [
        TriggerModule,
        StateHistoryNode as unknown as NodeModule,
        SetGlobalStoreNode as unknown as NodeModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'history', type: 'net.noodl.StateHistory' },
              { id: 'set', type: 'net.noodl.GlobalStore.Set', parameters: { key: 'title' } }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'set', targetPort: 'value' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'set', targetPort: 'set' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(2);

    expect(stateHistoryManager.isTracking('app')).toBe(true);

    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send('Hello');
    trigger.go();
    await graph.settle(3);

    const info = stateHistoryManager.getHistoryInfo('app');
    // Initial state plus the change: the invariant this manager is built around is that
    // `entries[currentIndex]` describes live state, so a recorded change is two entries.
    expect(info && info.size).toBe(2);
    expect(info && info.canUndo).toBe(true);
  });
});

/* ================================================================== *
 * A1/B — the SSE node did not follow a URL change
 * ================================================================== */

describe('A1 — Server-Sent Events follows a URL change, as the WebSocket node does', () => {
  /**
   * The rig: a fetch that never resolves, so the connection stays `connecting` and the row is
   * about *which URL was asked for*, not about what came back. `_internal.seams` is the node's
   * own injection point and is how `agent-sse-node.test.ts` drives it too.
   */
  interface SseInstanceLike extends NodeInstance {
    _internal: { seams: Record<string, unknown>; connection: { transportKind: string } | null };
  }

  async function sseGraph(urls: string[]): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, SSENode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'sse', type: 'net.noodl.SSE', parameters: { autoConnect: true, url: 'https://one.example/s' } }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'value', targetId: 'sse', targetPort: 'url' }]
          }
        ]
      } as never
    });

    const node = graph.node<SseInstanceLike>('sse');
    node._internal.seams = {
      fetchImpl: (url: string) => {
        urls.push(url);
        return new Promise<never>(() => {
          /* never settles: the row is about the request that was made */
        });
      },
      AbortControllerImpl: class {
        signal = {};
        abort() {
          /* nothing to abort in a request that never settles */
        }
      },
      setTimeoutImpl: () => 1,
      clearTimeoutImpl: () => undefined
    };
    return graph;
  }

  it('reconnects to the new URL when Auto Connect is on', async () => {
    const urls: string[] = [];
    const graph = await sseGraph(urls);
    await graph.settle(3);
    expect(urls).toEqual(['https://one.example/s']);

    graph.node<TriggerInstance>('trigger').send('https://two.example/s');
    await graph.settle(3);

    expect(urls).toEqual(['https://one.example/s', 'https://two.example/s']);
  });

  /**
   * The control. A rebuild on *every* scheduled pass would reopen the stream on any input
   * change — including the reconnection tuning inputs — which is the failure the WebSocket
   * node's `identityChanged` guard exists to prevent, and reopening an agent stream re-issues
   * the prompt.
   */
  it('does not reopen the stream when the URL is set to the same value again', async () => {
    const urls: string[] = [];
    const graph = await sseGraph(urls);
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').send('https://one.example/s');
    await graph.settle(3);

    expect(urls).toEqual(['https://one.example/s']);
  });
});

/* ================================================================== *
 * B1/B3 — four nodes ended a signal input in an `error` string
 * ================================================================== */

describe('B1 — a signal input that cannot do its work reports a failure', () => {
  /**
   * Five nodes in this directory already have `Failure` + `raiseRuntimeError` (`Stream
   * Buffer`, `JSON Stream Parser`, `Pattern Extractor`, `State Snapshot`, `Undo / Redo`, three
   * of them fixed by NDA-004 §2). These four were written to the same family's *older*
   * convention — a string `Error` output and nothing else — so an author had a success signal
   * to wire and nothing at all to sequence off a failure.
   *
   * ⚠️ The worksheet's machine-derived `B1` column cannot see this: it matches
   * `/fail|error/i` against output *names* (`worksheets.js:55`), and a string port called
   * `Error` satisfies it. Every one of these four is pre-filled "✅ has one".
   */
  async function failureGraph(
    module: NodeModule,
    type: string,
    parameters: Record<string, unknown>,
    actionPort: string
  ): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [TriggerModule, WatcherModule, module],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'subject', type, parameters },
              { id: 'watcher', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'subject', targetPort: actionPort },
              { sourceId: 'subject', sourcePort: 'failure', targetId: 'watcher', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });
  }

  it('Set Global Store — Set with no Key', async () => {
    const graph = await failureGraph(SetGlobalStoreNode as unknown as NodeModule, 'net.noodl.GlobalStore.Set', {}, 'set');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
    expect(graph.errors.map((e) => e.code)).toContain('global-store/set-failed');
  });

  it('Set Global Store — a Set that works stays quiet', async () => {
    const graph = await failureGraph(
      SetGlobalStoreNode as unknown as NodeModule,
      'net.noodl.GlobalStore.Set',
      { key: 'title', value: 'x' },
      'set'
    );
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(0);
    expect(graph.errors).toEqual([]);
  });

  it('Optimistic Update — Apply with no Key', async () => {
    const graph = await failureGraph(
      OptimisticUpdateNode as unknown as NodeModule,
      'net.noodl.OptimisticUpdate',
      {},
      'apply'
    );
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
    expect(graph.errors.map((e) => e.code)).toContain('optimistic-update/operation-failed');
  });

  it('Optimistic Update — Commit with nothing in flight', async () => {
    const graph = await failureGraph(
      OptimisticUpdateNode as unknown as NodeModule,
      'net.noodl.OptimisticUpdate',
      { key: 'title' },
      'commit'
    );
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
  });

  it('Optimistic Update — an Apply that works stays quiet', async () => {
    const graph = await failureGraph(
      OptimisticUpdateNode as unknown as NodeModule,
      'net.noodl.OptimisticUpdate',
      { key: 'title' },
      'apply'
    );
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(0);
    expect(graph.errors).toEqual([]);

    /**
     * An Apply that succeeds leaves the transaction *open*, and an open transaction owns a
     * rollback `setTimeout` (`optimisticupdatenode.ts:524`) until something commits, rolls
     * back or deletes the node. Leaving it armed made the whole package's run report
     * "a worker process has failed to exit gracefully" — 0 failures, and a new warning that
     * had not been there before.
     *
     * Deleting the node is the honest teardown rather than `jest.useFakeTimers`, because
     * `_onNodeDeleted` clearing that timer is the H1 contract this family is being audited
     * against — so the cleanup doubles as the control for it.
     */
    (graph.node('subject') as unknown as CorpusNode)._onNodeDeleted();
  });

  it('Action Handler — Complete with no action in flight', async () => {
    const graph = await failureGraph(
      ActionHandlerNode as unknown as NodeModule,
      'net.noodl.ActionHandler',
      { actionType: 'OPEN' },
      'complete'
    );
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
    expect(graph.errors.map((e) => e.code)).toContain('action-handler/operation-failed');
  });

  it('Text Accumulator — a chunk that is not text', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, WatcherModule, TextAccumulatorNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'subject', type: 'net.noodl.TextAccumulator' },
              { id: 'watcher', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'subject', targetPort: 'chunk' },
              { sourceId: 'subject', sourcePort: 'failure', targetId: 'watcher', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });

    // The exact mis-wiring the node's own docstring names: a stream's JSON-parsed `Data`
    // output wired into `Chunk` instead of its `Text` output.
    graph.node<TriggerInstance>('trigger').send({ delta: 'Hi' });
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
    expect(graph.errors.map((e) => e.code)).toContain('text-accumulator/chunk-not-text');
    // B2: the editor warning stays, because an author who has just mis-wired a port has not
    // wired anything to `Failure` either. It is now the *second* channel, not the only one.
    expect(graph.editorConnection.hasWarningFor('subject')).toBe(true);
  });

  it('Text Accumulator — a text chunk stays quiet', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, WatcherModule, TextAccumulatorNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'subject', type: 'net.noodl.TextAccumulator' },
              { id: 'watcher', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'subject', targetPort: 'chunk' },
              { sourceId: 'subject', sourcePort: 'failure', targetId: 'watcher', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });

    graph.node<TriggerInstance>('trigger').send('Hi');
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(0);
    expect(graph.errors).toEqual([]);
  });
});

/* ================================================================== *
 * B1 — Pattern Extractor: a blank pattern is not "no match"
 * ================================================================== */

describe('B1 — Pattern Extractor tells an unusable pattern from a pattern that found nothing', () => {
  /**
   * `pattern-extractor.ts:202-208` says it in as many words — *"An unusable pattern is
   * distinct from 'no match': one is a bug to fix, the other is a normal outcome, and
   * collapsing them hides broken patterns."* — and then `extractPattern`'s first line,
   * `if (!pattern) return empty`, returns `ok: true`, which collapses exactly those two.
   *
   * A blank `Pattern` is the state every one of these nodes is in the moment it is dropped on
   * the canvas, so `Extract` on an unconfigured node fired `Not Found` and looked like data.
   */
  it('a blank pattern is a failure, not a not-found', () => {
    const result = extractPattern('Processing... 45% complete', '');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pattern/i);
  });

  it('a pattern that genuinely matches nothing is still ok', () => {
    const result = extractPattern('Processing... 45% complete', '(\\d+) files');
    expect(result.ok).toBe(true);
    expect(result.match).toBe(null);
  });

  it('a pattern that matches is unaffected', () => {
    const result = extractPattern('Processing... 45% complete', '(\\d+)%');
    expect(result.ok).toBe(true);
    expect(result.match).toBe('45%');
    expect(result.groups).toEqual(['45']);
  });

  async function extractorGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [TriggerModule, WatcherModule, PatternExtractorNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'subject', type: 'net.noodl.PatternExtractor', parameters },
              { id: 'failure', type: 'corpus.Watcher' },
              { id: 'notFound', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'subject', targetPort: 'extract' },
              { sourceId: 'subject', sourcePort: 'failure', targetId: 'failure', targetPort: 'pulse' },
              { sourceId: 'subject', sourcePort: 'notFound', targetId: 'notFound', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });
  }

  it('Extract on a node with no Pattern set fires Failure and not Not Found', async () => {
    const graph = await extractorGraph({ text: 'anything' });
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('failure')._internal.pulses).toBe(1);
    expect(graph.node<WatcherInstance>('notFound')._internal.pulses).toBe(0);
  });

  it('Extract with a pattern that finds nothing still fires Not Found', async () => {
    const graph = await extractorGraph({ text: 'anything', pattern: 'zzz' });
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('failure')._internal.pulses).toBe(0);
    expect(graph.node<WatcherInstance>('notFound')._internal.pulses).toBe(1);
  });
});

/* ================================================================== *
 * H1 — what the family already gets right, pinned so it stays right
 * ================================================================== */

describe('H1 — nothing survives the node that owned it', () => {
  /**
   * These pass today. They are rows rather than prose because SR-vi is the phase's clearest
   * warning that this class regresses one file at a time: four Animation nodes leaked a timer
   * that a fifth node, in a different category, had always cleared.
   */
  it('Global Store and Subscribe to Store drop their subscriptions on delete', async () => {
    const graph = await createCorpusGraph({
      modules: [GlobalStoreNode as unknown as NodeModule, SubscribeToStoreNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'store', type: 'net.noodl.GlobalStore' },
              { id: 'subscribe', type: 'net.noodl.GlobalStore.Subscribe' }
            ],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(2);
    expect(globalStoreManager.subscriberCount('app')).toBe(2);

    (graph.node('store') as unknown as CorpusNode)._onNodeDeleted();
    (graph.node('subscribe') as unknown as CorpusNode)._onNodeDeleted();

    expect(globalStoreManager.subscriberCount('app')).toBe(0);
  });

  it('State History releases its history when the last tracker goes', async () => {
    const graph = await createCorpusGraph({
      modules: [StateHistoryNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [{ name: '/root', nodes: [{ id: 'history', type: 'net.noodl.StateHistory' }], connections: [] }]
      } as never
    });
    await graph.settle(2);
    expect(stateHistoryManager.isTracking('app')).toBe(true);

    (graph.node('history') as unknown as CorpusNode)._onNodeDeleted();

    expect(stateHistoryManager.isTracking('app')).toBe(false);
    expect(globalStoreManager.subscriberCount('app')).toBe(0);
  });

  it('Stream Buffer stops its flush timer on delete', async () => {
    let armed = 0;
    let cleared = 0;
    const graph = await createCorpusGraph({
      modules: [TriggerModule, StreamBufferNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'buffer', type: 'net.noodl.StreamBuffer', parameters: { flushInterval: 1000 } }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'buffer', targetPort: 'data' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'buffer', targetPort: 'add' }
            ]
          }
        ]
      } as never
    });

    (graph.node('buffer')._internal as { seams: Record<string, unknown> }).seams = {
      setTimeoutImpl: () => {
        armed++;
        return 7;
      },
      clearTimeoutImpl: () => {
        cleared++;
      }
    };

    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send('a');
    trigger.go();
    await graph.settle(3);
    expect(armed).toBe(1);

    (graph.node('buffer') as unknown as CorpusNode)._onNodeDeleted();
    expect(cleared).toBe(1);
  });

  it('Action Handler unregisters, and fails an action it was mid-way through', async () => {
    const graph = await createCorpusGraph({
      modules: [ActionHandlerNode as unknown as NodeModule, ActionDispatcherNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'handler', type: 'net.noodl.ActionHandler', parameters: { actionType: 'OPEN' } }],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(2);
    expect(actionRegistry.handlerCount('default', 'OPEN')).toBe(1);

    (graph.node('handler') as unknown as CorpusNode)._onNodeDeleted();
    expect(actionRegistry.handlerCount('default', 'OPEN')).toBe(0);
  });

  /**
   * **Filed, not fixed** — the row pins today's behaviour so a change to it is deliberate.
   *
   * A named snapshot holds a deep copy of the whole store and lives in a module-global map
   * that nothing reference-counts. The history beside it *is* reference-counted (`attach`
   * returns a detach and the record dies with the last node), so the asymmetry is real:
   * every `Save` a component performs on mount is retained for the life of the page, and a
   * chat surface that snapshots per conversation grows without bound.
   *
   * It is not obviously a bug, which is why it is a filing. The mechanism is *named*: a
   * `State Snapshot` node in one component is meant to restore a checkpoint another one
   * saved, and dropping snapshots when the saving node unmounts would break exactly that.
   * The node has a `Delete` verb in neither its ports nor its manager surface
   * (`deleteNamedSnapshot` exists and nothing calls it), so an author has no way to release
   * one either. That, rather than the retention, is the part worth deciding.
   */
  it('State Snapshot keeps its named snapshots after the node is deleted (filed: nothing can release them)', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, StateSnapshotNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'snap', type: 'net.noodl.StateSnapshot', parameters: { snapshotName: 'before' } }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'snap', targetPort: 'save' }]
          }
        ]
      } as never
    });

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    expect(stateHistoryManager.getSnapshotNames()).toEqual(['before']);

    (graph.node('snap') as unknown as CorpusNode)._onNodeDeleted();
    expect(stateHistoryManager.getSnapshotNames()).toEqual(['before']);
  });

  /**
   * `StateHistoryManager.configure` used to return early from the `trackKeys` branch, past
   * the `enabled` line below it. The node hands every option in one object from one deferred
   * pass, so an author who changed `Track Keys` and `Enabled` in the same frame — which is
   * what an editor does when two fields are edited before the next update — got the pause
   * silently dropped.
   */
  it('State History applies Enabled even in the pass that changed Track Keys', () => {
    stateHistoryManager.attach('app', { trackKeys: ['a'] }, () => undefined);
    globalStoreManager.setKey('app', 'a', 1);
    expect((stateHistoryManager.getHistoryInfo('app') as { size: number }).size).toBe(2);

    stateHistoryManager.configure('app', { trackKeys: ['b'], enabled: false });
    expect((stateHistoryManager.getHistoryInfo('app') as { enabled: boolean }).enabled).toBe(false);

    globalStoreManager.setKey('app', 'b', 2);
    // Paused, so the reset baseline is all there is.
    expect((stateHistoryManager.getHistoryInfo('app') as { size: number }).size).toBe(1);
  });
});

/* ================================================================== *
 * G1 / A3 — the empty-value and coalescing rows that already pass
 * ================================================================== */

describe('G1 — the store nodes do not coerce an empty value', () => {
  async function setGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [TriggerModule, SetGlobalStoreNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'set', type: 'net.noodl.GlobalStore.Set', parameters }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'set', targetPort: 'value' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'set', targetPort: 'set' }
            ]
          }
        ]
      } as never
    });
  }

  it('null is stored as null rather than as "" or 0', async () => {
    const graph = await setGraph({ key: 'title' });
    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send(null);
    trigger.go();
    await graph.settle(3);

    expect(globalStoreManager.hasKey('app', 'title')).toBe(true);
    expect(globalStoreManager.getKey('app', 'title')).toBe(null);
  });

  it('Undo / Redo at the beginning of the history is a no-op, not a failure', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, WatcherModule, StateHistoryNode as unknown as NodeModule, UndoNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'history', type: 'net.noodl.StateHistory' },
              { id: 'undo', type: 'net.noodl.StateHistory.Undo' },
              { id: 'failure', type: 'corpus.Watcher' },
              { id: 'undone', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'undo', targetPort: 'undo' },
              { sourceId: 'undo', sourcePort: 'failure', targetId: 'failure', targetPort: 'pulse' },
              { sourceId: 'undo', sourcePort: 'undone', targetId: 'undone', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(2);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('failure')._internal.pulses).toBe(0);
    expect(graph.node<WatcherInstance>('undone')._internal.pulses).toBe(0);
  });
});

/* ================================================================== *
 * A3 — a coalesced parse still reports every value
 * ================================================================== */

describe('A3 — the stream nodes swallow nothing', () => {
  it('JSON Stream Parser emits every value in a chunk that held several', async () => {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, WatcherModule, JsonStreamParserNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'parser', type: 'net.noodl.JSONStreamParser' },
              { id: 'success', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'parser', targetPort: 'chunk' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'parser', targetPort: 'parse' },
              { sourceId: 'parser', sourcePort: 'success', targetId: 'success', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });

    const trigger = graph.node<TriggerInstance>('trigger');
    trigger.send('{"a":1}\n{"a":2}\n');
    trigger.go();
    await graph.settle(3);

    expect(graph.node('parser').getOutput('values').value).toEqual([{ a: 1 }, { a: 2 }]);
    expect(graph.node<WatcherInstance>('success')._internal.pulses).toBe(1);
  });
});
