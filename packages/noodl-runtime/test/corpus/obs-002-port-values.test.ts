/**
 * OBS-002 corpus — layer 1's value source, through a real graph.
 *
 * The provenance walk's first annotation layer claims to answer *"why is this label X?"* on a
 * **cold editor with nothing fired**. That claim rests entirely on `getPortValues` reading the
 * ports themselves rather than `_outputHistory`, which is a log of what was sent while debug
 * inspectors happened to be on — empty on an app that booted with debugging off.
 *
 * The distinction is invisible to a unit test on the reader, so every row here runs wired and
 * asserts against a graph that has propagated nothing since it was built.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

interface HolderInstance extends NodeInstance {
  emit(value: unknown): void;
}

/**
 * A node whose output getter is computed from its input, so an output read cannot be satisfied
 * by having seen the input go past — it has to call the getter.
 */
const HolderModule: NodeModule = {
  node: {
    name: 'obs2.Holder',
    category: 'Obs',
    initialize: function (this: NodeInstance) {
      this._internal.value = 'initial';
    },
    inputs: {
      in: {
        type: '*',
        default: 'default-in',
        set: function (this: NodeInstance, value: unknown) {
          this._internal.value = value;
        }
      }
    },
    outputs: {
      out: {
        type: '*',
        getter: function (this: NodeInstance) {
          return 'out:' + String(this._internal.value);
        }
      }
    },
    methods: {
      emit(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('out');
      }
    }
  }
};

/** A node with an input and an output that share a name — the Component Inputs shape. */
const PassThroughModule: NodeModule = {
  node: {
    name: 'obs2.PassThrough',
    category: 'Obs',
    initialize: function (this: NodeInstance) {
      this._internal.Value = 'passthrough-initial';
    },
    inputs: {
      Value: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          this._internal.Value = value;
          this.flagOutputDirty('Value');
        }
      }
    },
    outputs: {
      Value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return 'echo:' + String(this._internal.Value);
        }
      }
    }
  }
};

const ExploderModule: NodeModule = {
  node: {
    name: 'obs2.Exploder',
    category: 'Obs',
    outputs: {
      boom: {
        type: '*',
        getter: function () {
          throw new Error('this getter is hostile');
        }
      }
    }
  }
};

const MODULES = [HolderModule, PassThroughModule, ExploderModule];

function graphData() {
  return {
    components: [
      {
        name: '/root',
        nodes: [
          { id: 'holder', type: 'obs2.Holder' },
          { id: 'pass', type: 'obs2.PassThrough' },
          { id: 'boom', type: 'obs2.Exploder' }
        ],
        connections: [{ sourceId: 'holder', sourcePort: 'out', targetId: 'pass', targetPort: 'Value' }]
      }
    ]
  };
}

async function coldGraph(): Promise<CorpusGraph> {
  // Deliberately *not* warmed and never updated: this is the cold-editor case.
  return createCorpusGraph({ modules: MODULES, data: graphData() });
}

describe('OBS-002 — layer 1 reads ports, not a log of past sends', () => {
  it('returns a current value for every hop on a graph that has fired nothing', async () => {
    const graph = await coldGraph();

    const values = graph.context.getPortValues([
      { node: 'holder', port: 'in', direction: 'input' },
      { node: 'holder', port: 'out', direction: 'output' },
      { node: 'pass', port: 'Value', direction: 'input' }
    ]);

    expect(values.map((v) => v.value)).toEqual(['"default-in"', '"out:initial"', 'undefined']);
    expect(values.every((v) => v.exists)).toBe(true);
  });

  it('reads an unset input as undefined even when the node behaves as if it has a value', async () => {
    // ⚠️ Worth knowing before reading a walk. An input holds a value only if a `default` was
    // declared or something set it; `obs2.PassThrough` seeds `_internal.Value` in `initialize`
    // and its getter uses it, so the node *acts* initialised while its input port is empty.
    //
    // This is the honest answer rather than a gap: "this input was never set" is precisely
    // what the user asking "why is this empty?" needs to see, and inferring a value from the
    // node's internal state would be the walk quietly making something up. The contrast with
    // `holder.in` above — which declares a default and therefore reads it — is the whole shape
    // of the rule.
    const graph = await coldGraph();
    const [unset] = graph.context.getPortValues([{ node: 'pass', port: 'Value', direction: 'input' }]);

    expect(unset.exists).toBe(true);
    expect(unset.value).toBe('undefined');
  });

  it('works with debug inspectors and the trace both switched off', async () => {
    // The whole claim of layer 1. `_outputHistory` is populated only while
    // `debugInspectorsEnabled` is true, so a reader built on it would return nothing here.
    const graph = await coldGraph();
    expect(graph.context.debugInspectorsEnabled).toBeFalsy();
    expect(graph.context.traceEnabled).toBe(false);

    const [value] = graph.context.getPortValues([{ node: 'holder', port: 'out', direction: 'output' }]);
    expect(value.value).toBe('"out:initial"');
  });

  it('distinguishes an input from an output of the same name', async () => {
    // `Component Inputs`/`Component Outputs` re-emit `Result` as `Result`, and a `Variable`
    // has both a `Value` in and a `Value` out. A direction-blind read would return one of
    // these for both and silently mislabel every boundary crossing in a walk.
    const graph = await coldGraph();

    const values = graph.context.getPortValues([
      { node: 'pass', port: 'Value', direction: 'input' },
      { node: 'pass', port: 'Value', direction: 'output' }
    ]);

    expect(values[0].value).toBe('undefined');
    expect(values[1].value).toBe('"echo:passthrough-initial"');

    // And once the input does carry something, the two stay distinct rather than converging.
    graph.node<HolderInstance>('holder').emit('driven');
    graph.update();
    await Promise.resolve();

    const driven = graph.context.getPortValues([
      { node: 'pass', port: 'Value', direction: 'input' },
      { node: 'pass', port: 'Value', direction: 'output' }
    ]);
    expect(driven[0].value).toBe('"out:driven"');
    expect(driven[1].value).toBe('"echo:out:driven"');
  });

  it('tracks the live value rather than replaying the first one it saw', async () => {
    const graph = await coldGraph();
    graph.node<HolderInstance>('holder').emit('later');
    graph.update();
    await Promise.resolve();

    const [out] = graph.context.getPortValues([{ node: 'holder', port: 'out', direction: 'output' }]);
    expect(out.value).toBe('"out:later"');
  });
});

describe('OBS-002 — a bad node must not blank the walk', () => {
  it('survives a getter that throws and still answers for the other ports', async () => {
    const graph = await coldGraph();

    const values = graph.context.getPortValues([
      { node: 'boom', port: 'boom', direction: 'output' },
      { node: 'holder', port: 'out', direction: 'output' }
    ]);

    expect(values[0].value).toBe('<unreadable>');
    expect(values[1].value).toBe('"out:initial"');
  });

  it('reports a port that does not exist as absent rather than as holding undefined', async () => {
    // These read differently in the walk: `undefined` is a common and meaningful value in
    // this runtime, so conflating it with "no such port" would hide graph drift.
    const graph = await coldGraph();

    const [missingPort, missingNode] = graph.context.getPortValues([
      { node: 'holder', port: 'nonexistent', direction: 'input' },
      { node: 'no-such-node', port: 'out', direction: 'output' }
    ]);

    expect(missingPort.exists).toBe(false);
    expect(missingNode.exists).toBe(false);
  });

  it('ignores malformed requests instead of throwing at the caller', async () => {
    const graph = await coldGraph();
    const values = graph.context.getPortValues([
      null as never,
      { node: 'holder' } as never,
      { node: 'holder', port: 'out', direction: 'output' }
    ]);
    expect(values).toHaveLength(1);
  });

  it('answers with nothing at all before a root component exists', async () => {
    const graph = await coldGraph();
    graph.context.rootComponent = undefined;
    expect(graph.context.getPortValues([{ node: 'holder', port: 'out', direction: 'output' }])).toEqual([]);
  });
});

describe('OBS-002 — attaching to a trace already in progress', () => {
  it('hands over the topology again without disturbing the buffer', async () => {
    // `setTraceEnabled` sends the dictionary on the off→on transition only, so re-opening the
    // walk panel would otherwise have to toggle the trace — which destroys the very events
    // the panel was opened to read. The `getTraceDictionary` command exists so it does not
    // have to; what this row pins is the property that makes the command safe.
    const graph = await coldGraph();

    graph.context.setTraceEnabled(true);
    graph.node<HolderInstance>('holder').emit('recorded');
    graph.update();
    await Promise.resolve();

    const before = graph.context.getTraceEvents().length;
    expect(before).toBeGreaterThan(0);

    const dictionary = graph.context.buildSessionDictionary();
    expect(dictionary.nodes['holder']).toBeDefined();
    expect(dictionary.edges).toContainEqual({
      from: { node: 'holder', port: 'out' },
      to: { node: 'pass', port: 'Value' }
    });
    expect(graph.context.getTraceEvents()).toHaveLength(before);
  });
});
