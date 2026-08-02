/**
 * OBS-001 corpus — the trace substrate, through a real graph.
 *
 * Every one of these has to run wired. The defect OBS-001 exists to fix is a property of
 * *propagation* — a map keyed by output id that cannot hold the same wire firing twice — and a
 * unit test on the buffer would pass whether or not the runtime ever reached it. So the
 * headline rows below emit from one node, cross a wire, and assert on what the buffer holds.
 *
 * The two exceptions are at the bottom: the ring buffer's wrap and the value-preview cap are
 * genuinely local, and testing them through a graph would only obscure them.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import { DEFAULT_VALUE_CAP, TraceBuffer, previewValue } from '../../src/tracebuffer';

// ---------------------------------------------------------------------------
// Three throwaway nodes: something to emit from, something to relay through,
// and something to land in.
// ---------------------------------------------------------------------------

interface SourceInstance extends NodeInstance {
  emit(value: unknown): void;
  pulse(): void;
}

const SourceModule: NodeModule = {
  node: {
    name: 'obs.Source',
    category: 'Obs',
    initialize: function (this: NodeInstance) {
      this._internal.value = undefined;
    },
    outputs: {
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      },
      onEmit: { type: 'signal' }
    },
    methods: {
      emit(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      },
      pulse(this: NodeInstance) {
        this.sendSignalOnOutput('onEmit');
      }
    }
  }
};

/** Passes its input straight back out, so a cascade has a middle to reconstruct. */
const RelayModule: NodeModule = {
  node: {
    name: 'obs.Relay',
    category: 'Obs',
    initialize: function (this: NodeInstance) {
      this._internal.value = undefined;
    },
    inputs: {
      in: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          this._internal.value = value;
          // Sent synchronously inside the input setter — which is what puts this send inside
          // the window where `_currentCause` names the edge that delivered `in`.
          this.flagOutputDirty('out');
        }
      }
    },
    outputs: {
      out: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    }
  }
};

interface SinkInstance extends NodeInstance {
  seen: unknown[];
}

const SinkModule: NodeModule = {
  node: {
    name: 'obs.Sink',
    category: 'Obs',
    initialize: function (this: NodeInstance) {
      (this as unknown as SinkInstance).seen = [];
    },
    inputs: {
      in: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          (this as unknown as SinkInstance).seen.push(value);
        }
      }
    }
  }
};

const MODULES = [SourceModule, RelayModule, SinkModule];

/** Source → Relay → Sink. One wire in, one wire out, so a cause chain has two links. */
function chainGraph() {
  return {
    components: [
      {
        name: '/root',
        nodes: [
          { id: 'source', type: 'obs.Source' },
          { id: 'relay', type: 'obs.Relay' },
          { id: 'sink', type: 'obs.Sink' }
        ],
        connections: [
          { sourceId: 'source', sourcePort: 'value', targetId: 'relay', targetPort: 'in' },
          { sourceId: 'relay', sourcePort: 'out', targetId: 'sink', targetPort: 'in' }
        ]
      }
    ]
  };
}

/** One output wired to three inputs — the fan-out case. */
function fanOutGraph() {
  return {
    components: [
      {
        name: '/root',
        nodes: [
          { id: 'source', type: 'obs.Source' },
          { id: 'sinkA', type: 'obs.Sink' },
          { id: 'sinkB', type: 'obs.Sink' },
          { id: 'sinkC', type: 'obs.Sink' }
        ],
        connections: [
          { sourceId: 'source', sourcePort: 'value', targetId: 'sinkA', targetPort: 'in' },
          { sourceId: 'source', sourcePort: 'value', targetId: 'sinkB', targetPort: 'in' },
          { sourceId: 'source', sourcePort: 'value', targetId: 'sinkC', targetPort: 'in' }
        ]
      }
    ]
  };
}

/**
 * A frame of warm-up before anything is asserted.
 *
 * `queueInput` deliberately collapses the value queue until a node has updated once, so a
 * graph's very first frame is not representative of steady-state propagation.
 */
async function warmed(graph: CorpusGraph): Promise<CorpusGraph> {
  graph.update();
  await Promise.resolve();
  return graph;
}

describe('OBS-001 — per-edge append-only events', () => {
  it('records a wire firing twice in one frame as two events, with both values', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);

    const source = graph.node<SourceInstance>('source');
    source.emit('first');
    source.emit('second');
    graph.update();

    const onTheWire = graph.context
      .getTraceEvents()
      .filter((e) => e.fromNode === 'source' && e.toNode === 'relay');

    // The whole point of the task: the old map bumped a timestamp and kept one value.
    expect(onTheWire).toHaveLength(2);
    expect(onTheWire.map((e) => e.value)).toEqual(['"first"', '"second"']);
    expect(onTheWire[0].seq).toBeLessThan(onTheWire[1].seq);
  });

  it('gives fan-out to N inputs N sibling events sharing one cause', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: fanOutGraph() as never }));
    graph.context.setTraceEnabled(true);

    graph.node<SourceInstance>('source').emit('fanned');
    graph.update();

    const events = graph.context.getTraceEvents().filter((e) => e.fromNode === 'source');

    expect(events.map((e) => e.toNode).sort()).toEqual(['sinkA', 'sinkB', 'sinkC']);
    // Siblings: one cause between them, and distinct seqs.
    expect(new Set(events.map((e) => e.cause)).size).toBe(1);
    expect(new Set(events.map((e) => e.seq)).size).toBe(3);
  });

  it('carries a cause chain that reconstructs the propagation tree across a cascade', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);

    graph.node<SourceInstance>('source').emit('cascade');
    graph.update();

    const events = graph.context.getTraceEvents();
    const sourceToRelay = events.find((e) => e.fromNode === 'source' && e.toNode === 'relay');
    const relayToSink = events.find((e) => e.fromNode === 'relay' && e.toNode === 'sink');

    expect(sourceToRelay).toBeDefined();
    expect(relayToSink).toBeDefined();

    // The root of the cascade has no cause; the second hop names the first.
    expect(sourceToRelay!.cause).toBe(0);
    expect(relayToSink!.cause).toBe(sourceToRelay!.seq);

    // And the sink really did receive it — the trace describes a propagation that happened.
    expect(graph.node<SinkInstance>('sink').seen).toContain('cascade');
  });

  it('records a signal as one event of kind signal, not a pair of values', async () => {
    const graph = await warmed(
      await createCorpusGraph({
        modules: MODULES,
        data: {
          components: [
            {
              name: '/root',
              nodes: [
                { id: 'source', type: 'obs.Source' },
                { id: 'sink', type: 'obs.Sink' }
              ],
              connections: [{ sourceId: 'source', sourcePort: 'onEmit', targetId: 'sink', targetPort: 'in' }]
            }
          ]
        } as never
      })
    );
    graph.context.setTraceEnabled(true);

    graph.node<SourceInstance>('source').pulse();
    graph.update();

    const events = graph.context.getTraceEvents().filter((e) => e.fromPort === 'onEmit');
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('signal');
  });
});

describe('OBS-001 — the opt-in must stay free', () => {
  it('allocates no buffer and records nothing while tracing is off', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));

    graph.node<SourceInstance>('source').emit('unwatched');
    graph.update();

    // Not "an empty buffer" — no buffer at all.
    expect(graph.context._traceBuffer).toBeUndefined();
    expect(graph.context.getTraceEvents()).toEqual([]);
    // The propagation itself is unaffected.
    expect(graph.node<SinkInstance>('sink').seen).toContain('unwatched');
  });

  it('drops the buffer again when tracing is turned off', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));

    graph.context.setTraceEnabled(true);
    graph.node<SourceInstance>('source').emit('watched');
    graph.update();
    expect(graph.context.getTraceEvents().length).toBeGreaterThan(0);

    graph.context.setTraceEnabled(false);
    expect(graph.context._traceBuffer).toBeUndefined();
    expect(graph.context.getTraceEvents()).toEqual([]);
  });

  it('leaves the canvas wire-pulse path behaving exactly as it did', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));

    // The pulse path is gated on a live socket; the harness reports disconnected by default.
    graph.editorConnection.isConnected = () => true;
    graph.editorConnection.sendPulsingConnections = () => undefined;
    graph.editorConnection.sendDebugInspectorValues = () => undefined;
    graph.context.setDebugInspectorsEnabled(true);

    graph.node<SourceInstance>('source').emit('pulse-a');
    graph.update();
    const withoutTrace = Object.keys(graph.context.connectionsToPulse).sort();

    graph.context.connectionsToPulse = {};
    graph.context.setTraceEnabled(true);
    graph.node<SourceInstance>('source').emit('pulse-b');
    graph.update();
    const withTrace = Object.keys(graph.context.connectionsToPulse).sort();

    expect(withTrace).toEqual(withoutTrace);
    expect(withTrace.length).toBeGreaterThan(0);
  });
});

describe('OBS-001 — the session dictionary', () => {
  it('names every node and declares the topology, so a consumer needs no project access', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);

    const dictionary = graph.context.buildSessionDictionary();

    expect(Object.keys(dictionary.nodes)).toEqual(expect.arrayContaining(['source', 'relay', 'sink']));
    expect(dictionary.nodes['relay'].name).toBe('obs.Relay');

    expect(dictionary.edges).toEqual(
      expect.arrayContaining([
        { from: { node: 'source', port: 'value' }, to: { node: 'relay', port: 'in' } },
        { from: { node: 'relay', port: 'out' }, to: { node: 'sink', port: 'in' } }
      ])
    );

    // The point of shipping topology: a wire that never fired is still knowable, which is what
    // OBS-002's backward walk diffs against. Nothing has fired yet, so every edge is unfired.
    expect(graph.context.getTraceEvents()).toEqual([]);
    expect(dictionary.edges.length).toBeGreaterThanOrEqual(2);
  });

  it('lets an event be rendered with real node names using only the dictionary', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);
    graph.node<SourceInstance>('source').emit('named');
    graph.update();

    const dictionary = graph.context.buildSessionDictionary();
    const event = graph.context.getTraceEvents()[0];

    const rendered = `${dictionary.nodes[event.fromNode].name}.${event.fromPort} → ${
      dictionary.nodes[event.toNode].name
    }.${event.toPort}`;

    expect(rendered).toBe('obs.Source.value → obs.Relay.in');
  });
});

describe('OBS-001 — session lifetime', () => {
  it('clears the buffer on preview reload', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);
    graph.node<SourceInstance>('source').emit('before-reload');
    graph.update();
    expect(graph.context.getTraceEvents().length).toBeGreaterThan(0);

    // `reset()` is what the viewer runs on `applicationDataReloaded`. It also clears the
    // inspector pulse map, which the shared recording connection does not implement — stubbed
    // here rather than in `graph-harness.ts`, which the rest of the corpus shares.
    graph.editorConnection.sendPulsingConnections = () => undefined;

    graph.context.reset();

    expect(graph.context.getTraceEvents()).toEqual([]);
  });

  it('starts a recording empty even if the previous one left events behind', async () => {
    const graph = await warmed(await createCorpusGraph({ modules: MODULES, data: chainGraph() as never }));
    graph.context.setTraceEnabled(true);
    graph.node<SourceInstance>('source').emit('old-session');
    graph.update();

    graph.context.setTraceEnabled(false);
    graph.context.setTraceEnabled(true);

    expect(graph.context.getTraceEvents()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The two local cases. See the module header for why these are not wired.
// ---------------------------------------------------------------------------

describe('OBS-001 — the ring buffer', () => {
  it('bounds memory by dropping the oldest events, and keeps seq monotonic across the wrap', () => {
    const buffer = new TraceBuffer(10);
    for (let i = 0; i < 25; i++) {
      buffer.push(i, 0, 'a', 'out', 'b', 'in', String(i), 'value');
    }

    expect(buffer.size).toBe(10);

    const held = buffer.toArray();
    expect(held).toHaveLength(10);
    // Oldest first, and the fifteen that fell off are gone.
    expect(held[0].value).toBe('15');
    expect(held[9].value).toBe('24');
    // seq keeps counting; it is not an index into the ring.
    expect(held[0].seq).toBe(16);
    expect(held[9].seq).toBe(25);
  });

  it('returns only what a tailing consumer has not already read', () => {
    const buffer = new TraceBuffer(100);
    for (let i = 0; i < 10; i++) buffer.push(i, 0, 'a', 'out', 'b', 'in', String(i), 'value');

    const tail = buffer.since(7);
    expect(tail.map((e) => e.seq)).toEqual([8, 9, 10]);
  });
});

describe('OBS-001 — the value preview', () => {
  it('caps a large value instead of serialising it', () => {
    const big = Array.from({ length: 10000 }, (_, i) => ({ index: i, label: 'row ' + i }));

    const preview = previewValue(big);

    // The cap, plus the one-character ellipsis that marks the truncation.
    expect(preview.length).toBeLessThanOrEqual(DEFAULT_VALUE_CAP + 1);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.startsWith('[{index:0,label:"row 0"}')).toBe(true);
  });

  it('never throws, whatever it is handed', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    expect(() => previewValue(circular)).not.toThrow();
    expect(previewValue(circular)).toContain('[Circular]');

    expect(previewValue(undefined)).toBe('undefined');
    expect(previewValue(null)).toBe('null');
    expect(previewValue(NaN)).toBe('NaN');
    expect(previewValue('hi')).toBe('"hi"');
    expect(previewValue(42)).toBe('42');
  });

  it('summarises a Collection by identity rather than walking its contents', () => {
    class Collection {
      id = 'c1';
      items = Array.from({ length: 5000 }, (_, i) => i);
    }

    expect(previewValue(new Collection())).toBe('<Collection c1>');
  });
});
