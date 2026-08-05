/**
 * ERG-001 §4 — the small non-Data remainder that lives in `noodl-viewer-react`:
 * `Send Event`, `Open File Picker`, `Component Object` and `Parent Component Object`.
 *
 * | Node | Action port | Shape |
 * |---|---|---|
 * | `Event Sender` — Send Event | `Send` | `done` (was `sent`) · `failure` kept · `completed` |
 * | `Open File Picker` | `Open` | `done` (was `success`) · `unchanged` (was `cancelled`) · `failure` kept · `completed` |
 * | `net.noodl.ComponentObject` | `Fetch` | `done` **added** · `completed`; `Fetched`/`Changed` untouched |
 * | `net.noodl.ParentComponentObject` | `Fetch` | `done` **added** · `completed`; `failure` kept and now reachable from `Fetch` |
 *
 * ## ⚠️ Two nodes rename and two add beside, and the grep is what decides which
 *
 * The rule this phase has now applied seven times: *grep every caller of the method that sends
 * the "did something" signal. If any caller is an input setter or a subscription callback, the
 * signal is a value-level announcement, the outcome goes beside it, and you do not rename.*
 *
 * - **`Event Sender.sent`** — one caller, inside `sendEvent`'s own `valueChangedToTrue`. No
 *   setter route exists, so `Sent` *is* the invocation's outcome and is renamed.
 * - **`Open File Picker.success` / `.cancelled`** — both live in handlers installed by `Open`
 *   and nowhere else. Renamed.
 * - **`Parent Component Object.fetched`** — sent from `setModelId`, whose callers include the
 *   `targetComponent` **input setter**, `initialize`, the deferred `nodeScopeDidInitialize`
 *   resolution, and the `componentStateNodesChanged` **subscription callback**. Three of the
 *   five are not invocations. `Fetched` stays and `Done` goes beside it.
 * - **`Component Object.fetched`** — measured, this one *does* have a single port-only caller.
 *   It still keeps `Fetched` and gains `Done` beside it, because the two nodes are documented
 *   twins and splitting the family so one says `Fetched` and the other `Done` for the same
 *   author gesture is the per-node divergence `outcome.ts`'s docstring exists to prevent. Same
 *   call the Cloud Services slice made for `Record`/`User`, recorded rather than re-derived.
 *
 * ## ⚠️ `Cancelled` becomes `Unchanged` rather than sitting beside it
 *
 * A user closing the dialog with nothing chosen leaves every output exactly as it was and is
 * *not* a failure — the node's own source already said so at length ("a `Failure` here would
 * fire on a graph working exactly as written"). That is `Unchanged`'s definition, so keeping
 * both would ship two ports that always fire together, which is what the Variables slice
 * removed `Stored` to avoid. The "the user declined" meaning moves into the port description.
 *
 * ## ⚠️ A second `Open` before the first answers settles the first as `Unchanged`
 *
 * One `<input type="file">` element is reused, so a second `Open` reassigns `onchange` and
 * `oncancel` and the first attempt can never answer. Left alone that is a token minted and
 * never settled — the dead chain this contract exists to close, reintroduced by the fix. The
 * superseded invocation reports `Unchanged`, which is `WebSocket`'s recorded answer for a
 * `Connect` superseded by a later `Connect`: the author asked for it, so it is not a `Failure`.
 *
 * ## No `Unchanged` and no `Failure` on either Component Object
 *
 * `Fetch` republishes every property unconditionally — there is no branch that could decline —
 * so neither node gets an `Unchanged`. `Component Object` gets no `Failure` either, for the
 * reason its own source records: `_internal.model` is `componentState<own instance id>`, built
 * in `initialize`, and `Model.get` is create-on-read, so there is nothing to fail to find.
 * `Parent Component Object` walks and therefore can and does miss, so it keeps its `Failure`.
 * §5 must not be taught to expect the absent ports.
 *
 * ## What reverting reddens — predicted per *fixture*, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Component Object`'s token minted in `scheduleFetch` rather than at the `fetch` port | 2 — the value-arrival row and the coalescing row |
 * | `Component Object`'s tokens drained *before* `fetch()` rather than after | 1 — the ordering row |
 * | `Parent Component Object`'s `Fetch` with no parent back to a bare `return` | 1 — the no-parent row |
 * | `Parent Component Object`'s token minted in `setModelId` | 2 — the two counting rows; the setter-silence row stays green |
 * | `Open File Picker`'s supersede branch removed | 1 — the two-Opens row |
 * | `Open File Picker`'s empty-`FileList` branch reporting `done` | 1 — the empty-list row |
 * | `Event Sender` reporting before `sendGlobalEventFromEventSender` | **0** — nothing here observes both in one frame |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ComponentObjectModule = require('@noodl/runtime/src/nodes/std-library/componentutils/componentobject');
import EventSenderModule from '../../src/nodes/std-library/eventsender';
import OpenFilePickerModule from '../../src/nodes/std-library/openfilepicker';
import ParentComponentObjectModule from '../../src/nodes/std-library/componentutils/parentcomponentobject';

/** The terminal outcomes a node reported, from a mark. */
function outcomesOf(graph: CorpusGraph, id: string, from = 0): string[] {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, signal: string, from = 0): number {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === signal).length;
}

/** How many signals a node has already sent — the cut point for the two helpers above. */
function mark(graph: CorpusGraph, id: string): number {
  return graph.signalsFor(id).length;
}

function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** Every signal-typed output a definition declares, by wire name. */
function signalPortsOf(module: unknown): string[] {
  const outputs = ((module as NodeModule).node as { outputs: Record<string, { type?: unknown }> }).outputs;
  return Object.keys(outputs).filter((name) => {
    const type = outputs[name].type;
    return type === 'signal' || (type && (type as { name?: string }).name === 'signal');
  });
}

// =================================================================================================
// Send Event
// =================================================================================================

describe('ERG-001 §4: Send Event', () => {
  async function eventSenderGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [EventSenderModule as NodeModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'node', type: 'Event Sender', parameters }], connections: [] }]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a Send on a real channel reports Done then Completed, and Sent is gone', async () => {
    const graph = await eventSenderGraph({ channelName: 'ping' });
    pulse(graph, 'node', 'sendEvent');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.signalsFor('node')).not.toContain('sent');
    const signals = graph.signalsFor('node');
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('a Send with no channel name is a Failure carrying its existing code', async () => {
    const graph = await eventSenderGraph({});
    pulse(graph, 'node', 'sendEvent');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['event-sender/no-channel']);
  });

  /** Rule 2, counted: two invocations are two `Completed`s whatever they did. */
  test('two Sends in two frames report two outcomes and two Completeds', async () => {
    const graph = await eventSenderGraph({ channelName: 'ping' });
    pulse(graph, 'node', 'sendEvent');
    await graph.settle(3);
    pulse(graph, 'node', 'sendEvent');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('(pinned control) the port surface is exactly the three outcome signals', () => {
    expect(signalPortsOf(EventSenderModule).sort()).toEqual(['completed', 'done', 'failure']);
  });
});

// =================================================================================================
// Open File Picker
// =================================================================================================

/**
 * The node builds a real `<input type="file">` in `initialize`, and this package runs jest under
 * `testEnvironment: node`. The stub is the element's whole surface as the node uses it, so a row
 * can drive `onchange` / `oncancel` the way a browser would.
 */
interface FakeInput {
  type: string;
  value: string;
  accept?: string;
  capture?: string;
  onchange: ((e: unknown) => void) | null;
  oncancel: (() => void) | null;
  click(): void;
  clicks: number;
  clickThrows?: Error;
}

let fakeInputs: FakeInput[] = [];

function installFakeDocument() {
  fakeInputs = [];
  (globalThis as unknown as { document: unknown }).document = {
    createElement() {
      const input: FakeInput = {
        type: '',
        value: '',
        onchange: null,
        oncancel: null,
        clicks: 0,
        click() {
          input.clicks++;
          if (input.clickThrows) throw input.clickThrows;
        }
      };
      fakeInputs.push(input);
      return input;
    }
  };
}

describe('ERG-001 §4: Open File Picker', () => {
  beforeEach(installFakeDocument);
  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  async function pickerGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [OpenFilePickerModule as NodeModule],
      data: {
        components: [
          { name: '/root', nodes: [{ id: 'node', type: 'Open File Picker', parameters: {} }], connections: [] }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  const aFile = { name: 'a.png', size: 12, type: 'image/png' };

  test('a chosen file reports Done, after the metadata outputs are up to date', async () => {
    const graph = await pickerGraph();
    pulse(graph, 'node', 'open');
    await graph.settle(3);

    fakeInputs[0].onchange({ target: { files: [aFile] } });
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect((graph.node('node')._internal as { file?: { name: string } }).file.name).toBe('a.png');
    expect(graph.errors).toEqual([]);
  });

  test('a change event with an empty FileList is Unchanged, and raises nothing', async () => {
    const graph = await pickerGraph();
    pulse(graph, 'node', 'open');
    await graph.settle(3);

    fakeInputs[0].onchange({ target: { files: [] } });
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('the browser cancel event is Unchanged too, and Cancelled is gone', async () => {
    const graph = await pickerGraph();
    pulse(graph, 'node', 'open');
    await graph.settle(3);

    fakeInputs[0].oncancel();
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(graph.signalsFor('node')).not.toContain('cancelled');
  });

  test('a dialog that cannot be opened at all is a Failure with its code', async () => {
    const graph = await pickerGraph();
    fakeInputs[0].clickThrows = new Error('blocked by sandbox');
    pulse(graph, 'node', 'open');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['open-file-picker/open-failed']);
  });

  /**
   * ⚠️ The row the supersede branch exists for. A silence row cannot see a token that is minted
   * and never settled — measured three times in this phase — so this one counts.
   */
  test('a second Open settles the first as Unchanged, and the second still answers', async () => {
    const graph = await pickerGraph();
    pulse(graph, 'node', 'open');
    await graph.settle(3);
    pulse(graph, 'node', 'open');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);

    fakeInputs[0].onchange({ target: { files: [aFile] } });
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
    expect(graph.errors).toEqual([]);
  });

  test('(pinned control) the port surface is exactly the four outcome signals', () => {
    expect(signalPortsOf(OpenFilePickerModule).sort()).toEqual(['completed', 'done', 'failure', 'unchanged']);
  });
});

// =================================================================================================
// Component Object
// =================================================================================================

describe('ERG-001 §4: Component Object', () => {
  async function componentObjectGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [ComponentObjectModule as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              {
                id: 'node',
                type: 'net.noodl.ComponentObject',
                parameters: { properties: 'title' },
                ports: [
                  { name: 'value-title', plug: 'input/output', type: '*' },
                  { name: 'changed-title', plug: 'output', type: 'signal' }
                ]
              }
            ],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a Fetch reports Done then Completed, after the existing Fetched', async () => {
    const graph = await componentObjectGraph();
    const node = graph.node('node');
    node.registerOutputIfNeeded('value-title');
    node.setInputValue('value-title', 'hello');
    await graph.settle(3);

    const from = mark(graph, 'node');
    pulse(graph, 'node', 'fetch');
    await graph.settle(3);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('fetched'));
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  /** Only the port mints: a property arriving is a value arrival, and nobody invoked anything. */
  test('writing a property reports no outcome at all', async () => {
    const graph = await componentObjectGraph();
    const node = graph.node('node');
    node.registerOutputIfNeeded('value-title');

    const from = mark(graph, 'node');
    node.setInputValue('value-title', 'hello');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual([]);
    expect(countOf(graph, 'node', 'completed', from)).toBe(0);
  });

  /**
   * The coalescing guard drops the second pulse's *work* deliberately — that is how "set the
   * fields, then press Fetch" batches — and it must not drop the second pulse's outcome.
   */
  test('two Fetches coalesced into one pass still report two outcomes', async () => {
    const graph = await componentObjectGraph();
    const node = graph.node('node');

    const from = mark(graph, 'node');
    node.setInputValue('fetch', false);
    node.setInputValue('fetch', true);
    node.setInputValue('fetch', false);
    node.setInputValue('fetch', true);
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(2);
    expect(countOf(graph, 'node', 'fetched', from)).toBe(1);
  });

  test('(pinned control) no Failure and no Unchanged — this node can do neither', () => {
    expect(signalPortsOf(ComponentObjectModule).sort()).toEqual(['changed', 'completed', 'done', 'fetched']);
  });
});

// =================================================================================================
// Parent Component Object
// =================================================================================================

describe('ERG-001 §4: Parent Component Object', () => {
  /** No ancestor at all — the walk misses, which is this node's one real failure. */
  async function orphanGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [ParentComponentObjectModule as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'node', type: 'net.noodl.ParentComponentObject', parameters: { properties: 'title' } }],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  /** A parent that owns a Component Object, and a child holding the node under test. */
  async function nestedGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [ComponentObjectModule as NodeModule, ParentComponentObjectModule as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'owner', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } },
              { id: 'child', type: '/child', parameters: {} }
            ],
            connections: []
          },
          {
            name: '/child',
            nodes: [{ id: 'node', type: 'net.noodl.ParentComponentObject', parameters: { properties: 'title' } }],
            connections: []
          }
        ],
        rootComponent: '/root'
      } as never,
      rootComponent: '/root'
    });
    await graph.settle(4);
    return graph;
  }

  test('a Fetch with a resolved parent reports Done then Completed, after Fetched', async () => {
    const graph = await nestedGraph();

    const from = mark(graph, 'node');
    pulse(graph, 'node', 'fetch');
    await graph.settle(3);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('fetched'));
  });

  /**
   * ⚠️ The dead chain this closes. `Fetch` with nothing resolved called `setModelId(undefined)`,
   * which cleared the model and returned — no `fetched`, no `changed`, nothing anywhere.
   */
  test('a Fetch with no parent in scope is a Failure carrying a code', async () => {
    const graph = await orphanGraph();

    const from = mark(graph, 'node');
    const errorsBefore = graph.errors.length;
    pulse(graph, 'node', 'fetch');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['parent-component-object/fetch-no-parent']);
  });

  /**
   * ⚠️ A counting row, not a silence row. A token minted in the `targetComponent` setter is never
   * settled, so nothing is reported and a silence row stays green; what catches it is the next
   * `Fetch` draining the stale token and reporting twice.
   */
  test('retargeting reports nothing, and the Fetch after it reports exactly once', async () => {
    const graph = await nestedGraph();

    const from = mark(graph, 'node');
    graph.node('node').setInputValue('targetComponent', '');
    await graph.settle(3);
    expect(outcomesOf(graph, 'node', from)).toEqual([]);

    pulse(graph, 'node', 'fetch');
    await graph.settle(3);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
  });

  test('(pinned control) Failure is present and Unchanged deliberately is not', () => {
    expect(signalPortsOf(ParentComponentObjectModule).sort()).toEqual([
      'changed',
      'completed',
      'done',
      'failure',
      'fetched'
    ]);
  });
});

/** Keeps `NodeInstance` referenced so the import is not dropped by `isolatedModules`. */
export type _Unused = NodeInstance;
