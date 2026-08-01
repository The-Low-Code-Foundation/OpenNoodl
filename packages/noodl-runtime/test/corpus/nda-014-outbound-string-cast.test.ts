/**
 * NDA-014 corpus — the **outbound** half of the object/array <-> string typecasts.
 *
 * PORT-TYPE-CONTRACT.md is explicit about this one ("a Function `object` output wired to a
 * Text node shows JSON"), the code to do it was written into `setInputValue`, and until this
 * file there was **no row anywhere that exercised it**. That is how it shipped unable to fire:
 * the branch keys off `inputTypeName === 'string'`, and `nodedefinition.ts` only copied a
 * declared port's type onto the instance for `color`/`textStyle`/`array`/`object`. A declared
 * `string` port therefore had **no type at runtime**, the branch was never true on any graph,
 * and a Text node wired to an object output rendered `[object Object]`. Found by wiring it in
 * the running editor, not by a test — so the rows below go through a **real `defineNode`
 * registration and a real wire**, because that is the only shape in which the bug exists.
 *
 * ⚠️ The two `'*'`-port rows are controls, not padding. The cast is specific to `string`-typed
 * inputs; a row that only asserted "the sink got JSON" would pass just as well against a
 * runtime that stringified *everything*, which would be a worse bug than the one being fixed.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import SimpleJavascriptNode = require('../../src/nodes/std-library/simplejavascript');

interface EmitterInstance extends NodeInstance {
  emit(port: string, value: unknown): void;
}

/** One output per port type the contract names, each pushed on demand. */
const EmitterModule: NodeModule = {
  node: {
    name: 'corpus.Emitter',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      this._internal.values = {} as Record<string, unknown>;
    },
    outputs: {
      payload: {
        type: 'object',
        getter: function (this: NodeInstance) {
          return (this._internal.values as Record<string, unknown>).payload;
        }
      },
      rows: {
        type: 'array',
        getter: function (this: NodeInstance) {
          return (this._internal.values as Record<string, unknown>).rows;
        }
      },
      /** A `*` output — the shape the typecast table says nothing about. */
      loose: {
        type: '*',
        getter: function (this: NodeInstance) {
          return (this._internal.values as Record<string, unknown>).loose;
        }
      }
    },
    methods: {
      emit(this: NodeInstance, port: string, value: unknown) {
        (this._internal.values as Record<string, unknown>)[port] = value;
        this.flagOutputDirty(port);
      }
    }
  }
};

interface SinkInstance extends NodeInstance {
  seen: unknown[];
}

/** A `string`-typed input — the receiving half the cast keys off. */
const StringSinkModule: NodeModule = {
  node: {
    name: 'corpus.StringSink',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      (this as unknown as SinkInstance).seen = [];
    },
    inputs: {
      text: {
        type: 'string',
        set: function (this: NodeInstance, value: unknown) {
          (this as unknown as SinkInstance).seen.push(value);
        }
      }
    }
  }
};

/** The control: a `'*'` port must keep receiving the value untouched. */
const StarSinkModule: NodeModule = {
  node: {
    name: 'corpus.StarSink',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      (this as unknown as SinkInstance).seen = [];
    },
    inputs: {
      any: {
        type: '*',
        set: function (this: NodeInstance, value: unknown) {
          (this as unknown as SinkInstance).seen.push(value);
        }
      }
    }
  }
};

/** `Emitter → StringSink` and the same output → `StarSink`, so both read the same emission. */
async function wired(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [EmitterModule, StringSinkModule, StarSinkModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'emitter', type: 'corpus.Emitter' },
            { id: 'stringSink', type: 'corpus.StringSink' },
            { id: 'arraySink', type: 'corpus.StringSink' },
            { id: 'looseSink', type: 'corpus.StringSink' },
            { id: 'starSink', type: 'corpus.StarSink' }
          ],
          connections: [
            { sourceId: 'emitter', sourcePort: 'payload', targetId: 'stringSink', targetPort: 'text' },
            { sourceId: 'emitter', sourcePort: 'rows', targetId: 'arraySink', targetPort: 'text' },
            { sourceId: 'emitter', sourcePort: 'loose', targetId: 'looseSink', targetPort: 'text' },
            { sourceId: 'emitter', sourcePort: 'payload', targetId: 'starSink', targetPort: 'any' }
          ]
        }
      ]
    } as never
  });

  // Warm-up frame: `queueInput` collapses the value queue until a node has updated once,
  // which is a different path from the one under test.
  graph.update();
  return graph;
}

describe('NDA-014: an object or array reaching a string-typed input becomes JSON', () => {
  test('NDA-014: an object output wired to a string input arrives as JSON', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('stringSink');
    sink.seen.length = 0;

    // The contract's own worked example: a Function `object` output into a Text node.
    graph.node<EmitterInstance>('emitter').emit('payload', { user: 'Ada', roles: ['admin'] });
    graph.update();

    // Was: the object arrived raw and every Text node downstream rendered `[object Object]`.
    expect(sink.seen).toEqual(['{"user":"Ada","roles":["admin"]}']);
  });

  test('NDA-014: an array output wired to a string input arrives as JSON, not a bare join', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('arraySink');
    sink.seen.length = 0;

    graph.node<EmitterInstance>('emitter').emit('rows', ['one', 'two', 'three']);
    graph.update();

    // ⚠️ `one,two,three` is what an un-cast array renders as, and it looks deceptively
    // reasonable — which is why this row asserts the JSON form rather than "not empty".
    expect(sink.seen).toEqual(['["one","two","three"]']);
  });

  test('NDA-014 control: a `*` input still receives the object itself', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('starSink');
    sink.seen.length = 0;

    const value = { user: 'Ada', roles: ['admin'] };
    graph.node<EmitterInstance>('emitter').emit('payload', value);
    graph.update();

    expect(sink.seen).toHaveLength(1);
    expect(sink.seen[0]).toBe(value);
  });

  test('NDA-014 control: an ordinary string crosses a string input untouched', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('stringSink');
    sink.seen.length = 0;

    graph.node<EmitterInstance>('emitter').emit('payload', 'just text');
    graph.update();

    // No quoting, no JSON — the branch must not touch values that are already strings.
    expect(sink.seen).toEqual(['just text']);
  });

  test('NDA-014: a value with its own toString is left alone (the Date exemption)', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('stringSink');
    sink.seen.length = 0;

    const date = new Date(0);
    graph.node<EmitterInstance>('emitter').emit('payload', date);
    graph.update();

    // The guard is `Array.isArray(value) || String(value) === '[object Object]'`, and a Date
    // satisfies neither, so it falls through **untouched**. That is the whole content of the
    // exemption: JSON would have turned it into a quoted ISO string and broken the
    // long-standing date -> string cast, which renders at the consumer.
    //
    // ⚠️ `node.ts` says such values "keep the `String()` rendering they have always had".
    // They do not — nothing in this branch calls `String()`; the Date object itself is
    // delivered and the receiving node renders it. Asserted as identity so the row states
    // the mechanism rather than the comment.
    expect(sink.seen).toHaveLength(1);
    expect(sink.seen[0]).toBe(date);
  });

  /**
   * The two rows below pin the **scope** of the cast rather than the cast itself. Both are
   * behaviours an earlier task deliberately pinned, and both were broken by a first
   * implementation that keyed off the runtime shape of the value instead of the declared
   * port types. If someone later widens the cast back, these redden first.
   */
  test('NDA-014 scope: an object from a `*` output is NOT cast, even into a string input', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('looseSink');
    sink.seen.length = 0;

    const value = { name: 'FromLiteral' };
    graph.node<EmitterInstance>('emitter').emit('loose', value);
    graph.update();

    // The `Object` node's `Id` is fed exactly this way (NDA-012 C3): a plain object over a
    // `*` wire, which it dereferences into a record. JSON here would hand it a string id.
    expect(sink.seen).toHaveLength(1);
    expect(sink.seen[0]).toBe(value);
  });

  test('NDA-014 scope: setInputValue directly is NOT a typecast site', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('stringSink');
    sink.seen.length = 0;

    const value = { delta: ' there' };
    graph.node('stringSink').setInputValue('text', value);
    graph.update();

    // `net.noodl.TextAccumulator` refuses an object chunk and names the mis-wiring
    // (NDA-004 B1). It can only do that while the raw object still reaches its setter.
    expect(sink.seen).toHaveLength(1);
    expect(sink.seen[0]).toBe(value);
  });

  /**
   * ⚠️ **The acceptance row, and the one the others could not stand in for.**
   *
   * Every row above emits from `corpus.Emitter`, whose `payload` output declares
   * `type: 'object'` in the ordinary way — so they all passed while the running editor still
   * rendered `[object Object]`. The real Function node registers its author-declared outputs
   * *dynamically*, through `registerOutputIfNeeded`, and that path passed **no type at all**;
   * the author's choice lives in the `outtype-<label>` parameter. A fake that declares its
   * ports the easy way is a claim about the real collaborator, and nothing was checking it.
   * This row uses the real node, which is what criterion 1 actually names.
   */
  test('NDA-014 acceptance: a real Function `object` output wired to a string input shows JSON', async () => {
    const graph = await createCorpusGraph({
      modules: [SimpleJavascriptNode, StringSinkModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              {
                id: 'fn',
                type: 'JavaScriptFunction',
                parameters: {
                  functionScript: "Outputs.payload = { user: 'Ada', roles: ['admin'] };\n",
                  scriptOutputs: [{ id: 'p1', label: 'payload' }],
                  'outtype-payload': 'object'
                }
              },
              { id: 'sink', type: 'corpus.StringSink' }
            ],
            connections: [{ sourceId: 'fn', sourcePort: 'out-payload', targetId: 'sink', targetPort: 'text' }]
          }
        ]
      } as never
    });

    await graph.settle(3);

    const sink = graph.node<SinkInstance>('sink');
    expect(sink.seen).toContain('{"user":"Ada","roles":["admin"]}');
    expect(sink.seen).not.toContain('[object Object]');
  });

  test('NDA-014: a circular structure delivers empty and reports, rather than throwing', async () => {
    const graph = await wired();
    const sink = graph.node<SinkInstance>('stringSink');
    sink.seen.length = 0;

    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    // Mid-update is the dangerous place to throw: it would abandon the rest of the frame.
    expect(() => {
      graph.node<EmitterInstance>('emitter').emit('payload', circular);
      graph.update();
    }).not.toThrow();

    expect(sink.seen).toEqual(['']);
    expect(graph.editorConnection.warnings.map((w) => w.key)).toContain('unstringifiable-object-text');
  });
});
