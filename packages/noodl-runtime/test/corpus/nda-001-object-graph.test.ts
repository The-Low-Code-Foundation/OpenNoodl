/**
 * NDA-001 corpus — rows R10, E5, E6 and E8, all of them through a real graph.
 *
 * E8 is Richard's own report and the reason the corpus exists: *"if the value was not null
 * and then becomes null, that doesn't register, and the old value is stuck."* It has to run
 * node-to-node, because `Model` is already correct (`model.ts:314-339`) — a unit test on
 * `Model.set` would pass and prove nothing. So every test here is wired: an upstream node
 * emits, a wire carries it, a downstream node records what it saw.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import './expected-failure';

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Model = require('../../src/model');
import ModelNode2 = require('../../src/nodes/std-library/data/modelnode2');
import SetModelPropertiesNode = require('../../src/nodes/std-library/data/setmodelpropertiesnode');
import SimpleJavascriptNode = require('../../src/nodes/std-library/simplejavascript');
import StringModule = require('../../src/nodes/std-library/variables/string');

// ---------------------------------------------------------------------------
// Two throwaway nodes: something to emit from, and something to watch with.
// ---------------------------------------------------------------------------

interface SourceInstance extends NodeInstance {
  emit(value: unknown): void;
  pulse(): void;
}

/** Emits a value on `value` and a signal on `onEmit`, in that order, in one pass. */
const SourceModule: NodeModule = {
  node: {
    name: 'corpus.Source',
    category: 'Corpus',
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
        this.sendSignalOnOutput('onEmit');
      },
      pulse(this: NodeInstance) {
        this.sendSignalOnOutput('onEmit');
      }
    }
  }
};

interface SinkInstance extends NodeInstance {
  /** Every value delivered over the wire, in order. */
  seen: unknown[];
}

const SinkModule: NodeModule = {
  node: {
    name: 'corpus.Sink',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      (this as unknown as SinkInstance).seen = [];
    },
    inputs: {
      value: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          (this as unknown as SinkInstance).seen.push(value);
        }
      }
    }
  }
};

// ---------------------------------------------------------------------------
// E8 — the acceptance test.
// ---------------------------------------------------------------------------

/** `Source → String Variable → Sink`: the most ordinary way a value crosses a graph. */
async function throughAStringVariable(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [SourceModule, SinkModule, StringModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'source', type: 'corpus.Source' },
            { id: 'variable', type: 'String' },
            { id: 'sink', type: 'corpus.Sink' }
          ],
          connections: [
            { sourceId: 'source', sourcePort: 'value', targetId: 'variable', targetPort: 'value' },
            { sourceId: 'variable', sourcePort: 'savedValue', targetId: 'sink', targetPort: 'value' }
          ]
        }
      ]
    } as never
  });

  // One warm-up frame: until a node has updated once, `queueInput` deliberately collapses
  // its value queue, which is a different code path from the one under test.
  graph.update();
  return graph;
}

describe('NDA-001 E8: a value goes non-null, then null, then non-null', () => {
  test.failing('E8: two changes are observed downstream, and the cleared state is empty', async () => {
    const graph = await throughAStringVariable();
    const source = graph.node<SourceInstance>('source');
    const sink = graph.node<SinkInstance>('sink');

    sink.seen.length = 0;
    graph.signalsFor('variable').length = 0;

    for (const value of ['hello', null, 'world']) {
      source.emit(value);
      graph.update();
    }

    // Two changes after the first value: this half already works, and the pinned test below
    // holds it.
    expect(graph.signalsFor('variable')).toEqual(['changed', 'changed', 'changed']);

    // The half that does not. Today the sink receives `['hello', 'null', 'world']` — the
    // cleared state arrives as four characters of text that is truthy, indistinguishable
    // from content the user typed, and permanently stuck in every Text node downstream.
    expect(sink.seen).toEqual(['hello', '', 'world']);
  });

  // ✅ Pinned: a null does cross a plain wire, and it does reach an Object node's property.
  // NDA-003 changes what "empty" means; it must not stop empty from propagating at all.
  test('E8 (pinned): a null crossing a bare connection is delivered, not swallowed', async () => {
    const graph = await createCorpusGraph({
      modules: [SourceModule, SinkModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'source', type: 'corpus.Source' },
              { id: 'sink', type: 'corpus.Sink' }
            ],
            connections: [{ sourceId: 'source', sourcePort: 'value', targetId: 'sink', targetPort: 'value' }]
          }
        ]
      } as never
    });
    graph.update();

    const source = graph.node<SourceInstance>('source');
    const sink = graph.node<SinkInstance>('sink');
    sink.seen.length = 0;

    for (const value of ['hello', null, 'world']) {
      source.emit(value);
      graph.update();
    }

    expect(sink.seen).toEqual(['hello', null, 'world']);
  });
});

// ---------------------------------------------------------------------------
// E5 / E6 — Set Object Properties and the two kinds of empty.
// ---------------------------------------------------------------------------

/**
 * `Source → Set Object Properties → (model) → Object node → Sink`, with `title` typed.
 *
 * The `prop-title` port only exists because a connection targets it — it is a runtime
 * discovered port, which is exactly why these rows need a graph rather than a bare node.
 */
async function setObjectProperties(modelId: string, propertyType: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [SourceModule, SinkModule, SetModelPropertiesNode as unknown as NodeModule, ModelNode2],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'source', type: 'corpus.Source' },
            {
              id: 'setter',
              type: 'SetModelProperties',
              parameters: { modelId, properties: 'title', 'type-title': propertyType }
            },
            { id: 'object', type: 'Model2', parameters: { modelId, properties: 'title' } },
            { id: 'sink', type: 'corpus.Sink' }
          ],
          connections: [
            { sourceId: 'source', sourcePort: 'value', targetId: 'setter', targetPort: 'prop-title' },
            { sourceId: 'source', sourcePort: 'onEmit', targetId: 'setter', targetPort: 'store' },
            { sourceId: 'object', sourcePort: 'prop-title', targetId: 'sink', targetPort: 'value' }
          ]
        }
      ]
    } as never
  });
  await graph.settle(2);
  return graph;
}

describe('NDA-001 E5–E6: Set Object Properties and an empty value', () => {
  // ✅ Pinned. `modelcrudbase.ts:308` lets `null` through to `model.set`, and `Model` does
  // the right thing with it. NDA-003 may redefine null as "delete the key" — if it does, this
  // test is the one that has to be rewritten deliberately rather than discovered broken.
  test('E5: Set Object Properties fed null writes null onto the record', async () => {
    const graph = await setObjectProperties('corpus-e5', 'string');
    const setter = graph.node('setter');

    Model.get('corpus-e5').set('title', 'seed');

    setter.setInputValue('prop-title', null);
    setter.setInputValue('store', false);
    setter.setInputValue('store', true);
    await graph.settle(2);

    expect(Model.get('corpus-e5').get('title')).toBeNull();
  });

  /**
   * ⚠️ This row is marked ✅ "correct, but untested" in the NDA-001 spec, on the strength of
   * the `if (value !== undefined)` guard at `modelcrudbase.ts:308`. Running it says otherwise.
   * The guard has an `else`, and the `else` writes `_defaultValueForType[type]` — so an
   * `undefined` does not leave the key alone, it **overwrites** it with the type's default.
   * The spec's Today column is wrong, and the row belongs with the failures.
   */
  test.failing('E6: Set Object Properties fed undefined leaves the key alone', async () => {
    const graph = await setObjectProperties('corpus-e6', 'string');
    const setter = graph.node('setter');

    Model.get('corpus-e6').set('title', 'seed');

    setter.setInputValue('prop-title', undefined);
    setter.setInputValue('store', false);
    setter.setInputValue('store', true);
    await graph.settle(2);

    // Today: `''`. The record's real content is destroyed by a write that carried no value.
    expect(Model.get('corpus-e6').get('title')).toBe('seed');
  });

  test.failing('E6 (untyped): an undefined property with no declared type also leaves the key alone', async () => {
    const graph = await setObjectProperties('corpus-e6-untyped', '*');
    const setter = graph.node('setter');

    Model.get('corpus-e6-untyped').set('title', 'seed');

    setter.setInputValue('prop-title', undefined);
    setter.setInputValue('store', false);
    setter.setInputValue('store', true);
    await graph.settle(2);

    // Today: `undefined` — `_defaultValueForType[undefined]` is itself undefined, so the
    // key survives with nothing in it. Different wrong answer, same defect.
    expect(Model.get('corpus-e6-untyped').get('title')).toBe('seed');
  });
});

// ---------------------------------------------------------------------------
// R10 — the reactivity row that already works.
// ---------------------------------------------------------------------------

describe('NDA-001 R10: an Object node reports a property set from a Function node', () => {
  // ✅ Pinned. `modelnode2.ts:69-77` subscribes to the record's `change` and re-emits it as
  // the node's `changed` signal. This is the contract every other row in the corpus is
  // measured against, so NDA-002 must not disturb it.
  test('R10: Function node → Set Object Properties → Object node fires changed', async () => {
    const graph = await createCorpusGraph({
      modules: [
        SourceModule,
        SimpleJavascriptNode as unknown as NodeModule,
        SetModelPropertiesNode as unknown as NodeModule,
        ModelNode2
      ],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'source', type: 'corpus.Source' },
              {
                id: 'function',
                type: 'JavaScriptFunction',
                parameters: {
                  functionScript: "Outputs.title = 'written-by-the-function'; Outputs.done();",
                  scriptOutputs: 'title,done'
                },
                ports: [
                  { name: 'out-title', plug: 'output', type: 'string' },
                  { name: 'out-done', plug: 'output', type: 'signal' }
                ]
              },
              {
                id: 'setter',
                type: 'SetModelProperties',
                parameters: { modelId: 'corpus-r10', properties: 'title', 'type-title': 'string' }
              },
              { id: 'object', type: 'Model2', parameters: { modelId: 'corpus-r10', properties: 'title' } }
            ],
            connections: [
              { sourceId: 'source', sourcePort: 'onEmit', targetId: 'function', targetPort: 'run' },
              { sourceId: 'function', sourcePort: 'out-title', targetId: 'setter', targetPort: 'prop-title' },
              { sourceId: 'function', sourcePort: 'out-done', targetId: 'setter', targetPort: 'store' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(2);

    graph.signalsFor('object').length = 0;
    graph.node<SourceInstance>('source').pulse();
    await graph.settle(3);

    // No warning means the script itself ran clean — otherwise a `changed`-less result would
    // be indistinguishable from "the Function node threw".
    expect(graph.editorConnection.warnings).toEqual([]);
    expect(Model.get('corpus-r10').get('title')).toBe('written-by-the-function');
    expect(graph.signalsFor('object')).toContain('changed');
  });
});
