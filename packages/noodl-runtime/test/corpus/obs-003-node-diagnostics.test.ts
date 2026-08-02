/**
 * OBS-003 corpus — the diagnostics channel and the one generic check.
 *
 * See `dev-docs/reference/DIAGNOSTICS-CONTRACT.md`. Every row here exists in a pair: one that
 * proves the check **fires on the bad input**, and one that proves it **stays silent on the good
 * one**. A check with only the first half is untested — `return true` passes it.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `value !== value` branch in `_setValueFromConnection` | every "fires" row; no silent row moves |
 * | the `_nanInputs` clear branch | the clearing rows only |
 * | `setDiagnostic`'s `isRunningLocally` gate | the deployed-runtime row only |
 * | the per-port key suffix | the two-ports row only, which is why it asserts on the key set |
 */

/* eslint-env jest */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, createRecordingEditorConnection, type CorpusGraph } from './graph-harness';

const NAN_KEY = 'node/nan-input/';

/**
 * A node that emits whatever it is handed, so a row can put a value *on a wire*.
 *
 * The check lives in `_setValueFromConnection` and nowhere else on purpose: a parameter typed
 * into the property panel cannot be NaN, so guarding `setInputValue` would cost every author a
 * comparison to catch a case that does not exist.
 */
const SourceModule: NodeDefinitionOptions = {
  name: 'corpus.Source',
  category: 'corpus',
  inputs: {
    send: {
      type: '*',
      set: function (this: NodeInstance, value: unknown) {
        (this as unknown as { _v: unknown })._v = value;
        this.flagOutputDirty('out');
      }
    }
  },
  outputs: {
    out: {
      type: 'number',
      getter: function (this: NodeInstance) {
        return (this as unknown as { _v: unknown })._v;
      }
    }
  }
};

/** A node with two plain number inputs, so a row can show two ports diagnosed independently. */
const SinkModule: NodeDefinitionOptions = {
  name: 'corpus.Sink',
  category: 'corpus',
  inputs: {
    width: { type: 'number', set: function () { /* the value only has to arrive */ } },
    height: { type: 'number', set: function () { /* ditto */ } }
  },
  outputs: {}
};

async function twoWireGraph(): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [SourceModule as unknown as NodeModule, SinkModule as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'sourceA', type: 'corpus.Source' },
            { id: 'sourceB', type: 'corpus.Source' },
            { id: 'sink', type: 'corpus.Sink' }
          ],
          connections: [
            { sourceId: 'sourceA', sourcePort: 'out', targetId: 'sink', targetPort: 'width' },
            { sourceId: 'sourceB', sourcePort: 'out', targetId: 'sink', targetPort: 'height' }
          ]
        }
      ]
    } as never
  });
}

/** Warning keys currently live on the sink, which is what "is the ring on" means. */
function keysOn(graph: CorpusGraph, id = 'sink'): string[] {
  return graph.editorConnection.warnings.filter((w) => w.nodeId === id).map((w) => w.key);
}

function messageFor(graph: CorpusGraph, key: string, id = 'sink'): string | undefined {
  const found = graph.editorConnection.warnings.find((w) => w.nodeId === id && w.key === key);
  return found && found.message;
}

describe('OBS-003: node/nan-input', () => {
  test('A NaN arriving over a wire raises a diagnostic naming the port', async () => {
    const graph = await twoWireGraph();

    graph.node('sourceA').setInputValue('send', Number('12px'));
    graph.update();

    expect(keysOn(graph)).toEqual([NAN_KEY + 'width']);
    expect(messageFor(graph, NAN_KEY + 'width')).toContain('"width"');
    expect(messageFor(graph, NAN_KEY + 'width')).toContain('NaN');
  });

  // The silent half. `0` is the one that matters: it is falsy, and a check written as
  // `if (!value)` rather than `value !== value` passes every row above and fires on every
  // zero in the project.
  test.each([
    ['a whole number', 42],
    ['zero', 0],
    ['a negative', -1],
    ['Infinity', Infinity],
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a string', 'hello'],
    ['false', false]
  ])('%s raises nothing', async (_label, value) => {
    const graph = await twoWireGraph();

    graph.node('sourceA').setInputValue('send', value);
    graph.update();

    expect(keysOn(graph)).toEqual([]);
  });

  test('A real number arriving after a NaN clears the diagnostic', async () => {
    const graph = await twoWireGraph();

    graph.node('sourceA').setInputValue('send', NaN);
    graph.update();
    expect(keysOn(graph)).toEqual([NAN_KEY + 'width']);

    graph.node('sourceA').setInputValue('send', 7);
    graph.update();

    expect(keysOn(graph)).toEqual([]);
    expect(graph.editorConnection.cleared).toContainEqual({ nodeId: 'sink', key: NAN_KEY + 'width' });
  });

  test('Two NaN ports are two independently clearable diagnostics, not one that flickers', async () => {
    const graph = await twoWireGraph();

    graph.node('sourceA').setInputValue('send', NaN);
    graph.node('sourceB').setInputValue('send', NaN);
    graph.update();

    expect(keysOn(graph).sort()).toEqual([NAN_KEY + 'height', NAN_KEY + 'width']);

    // Fixing one leaves the other ringed — the failure mode a single un-suffixed key would have.
    graph.node('sourceA').setInputValue('send', 1);
    graph.update();

    expect(keysOn(graph)).toEqual([NAN_KEY + 'height']);
  });

  test('A NaN that stays NaN is reported once, not once per delivery', async () => {
    const graph = await twoWireGraph();

    for (let i = 0; i < 5; i++) {
      graph.node('sourceA').setInputValue('send', NaN);
      graph.update();
    }

    expect(keysOn(graph)).toEqual([NAN_KEY + 'width']);
    expect(graph.editorConnection.warnings.filter((w) => w.key === NAN_KEY + 'width')).toHaveLength(1);
  });
});

describe('OBS-003: setDiagnostic', () => {
  test('A falsy message clears the key rather than raising an empty warning', async () => {
    const graph = await twoWireGraph();
    const sink = graph.node('sink');

    sink.setDiagnostic('corpus/predicate', 'it holds');
    expect(keysOn(graph)).toEqual(['corpus/predicate']);

    sink.setDiagnostic('corpus/predicate', null);
    expect(keysOn(graph)).toEqual([]);
    expect(graph.editorConnection.cleared).toContainEqual({ nodeId: 'sink', key: 'corpus/predicate' });
  });

  test.each([[null], [undefined], ['']])('%p clears', async (message) => {
    const graph = await twoWireGraph();
    const sink = graph.node('sink');

    sink.setDiagnostic('corpus/predicate', 'it holds');
    sink.setDiagnostic('corpus/predicate', message as string | null);

    expect(keysOn(graph)).toEqual([]);
  });

  /**
   * ⚠️ The row the contract's cost clause rests on.
   *
   * A deployed build constructs an `EditorConnection` on purpose (`noodl-runtime.ts:286-295`), so
   * `if (this.context.editorConnection)` — the guard most existing warning call sites use — is
   * **true in production**. `isRunningLocally()` is the one that is not.
   */
  test('Nothing is sent when the runtime is not running locally', async () => {
    const graph = await twoWireGraph();
    const connection = graph.editorConnection;
    connection.isRunningLocally = () => false;

    graph.node('sink').setDiagnostic('corpus/predicate', 'it holds');
    graph.node('sourceA').setInputValue('send', NaN);
    graph.update();

    expect(connection.warnings).toEqual([]);
    expect(connection.cleared).toEqual([]);
  });

  test('diagnosticsEnabled follows the same gate', async () => {
    const graph = await twoWireGraph();
    expect(graph.node('sink').diagnosticsEnabled).toBe(true);

    graph.editorConnection.isRunningLocally = () => false;
    expect(graph.node('sink').diagnosticsEnabled).toBe(false);
  });

  test('A node with no editor connection at all reports nothing and does not throw', () => {
    const orphan = {
      id: 'orphan',
      context: {},
      setDiagnostic(this: unknown, key: string, message?: string | null) {
        // Reach the real implementation the way `Node.prototype` does.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../../src/diagnostics').setDiagnostic(this, key, message);
      }
    };

    expect(() => orphan.setDiagnostic('corpus/predicate', 'it holds')).not.toThrow();
  });
});

describe('OBS-003: describeValue', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { describeValue } = require('../../src/diagnostics') as { describeValue(v: unknown): string };

  test.each([
    [null, 'null'],
    [undefined, 'nothing'],
    ['abc', 'a string ("abc")'],
    [3, 'a number (3)'],
    [NaN, 'NaN'],
    [true, 'a boolean (true)'],
    [[1, 2, 3], 'an array of 3 items'],
    [[1], 'an array of 1 item'],
    [{}, 'an object']
  ])('%p reads as %s', (value, expected) => {
    expect(describeValue(value)).toBe(expected);
  });

  test('A long string is excerpted rather than filling the Problems panel', () => {
    const described = describeValue('x'.repeat(500));
    expect(described.length).toBeLessThan(80);
    expect(described).toContain('…');
  });
});

describe('OBS-003: the recording connection itself', () => {
  // Guards the harness the rows above trust: if `clearWarning` stopped removing the entry,
  // every "stays silent" row would pass by accident.
  test('clearWarning removes the entry the assertions read', () => {
    const connection = createRecordingEditorConnection();

    connection.sendWarning('/root', 'n', 'k', { message: 'm' });
    expect(connection.hasWarningFor('n')).toBe(true);

    connection.clearWarning('/root', 'n', 'k');
    expect(connection.hasWarningFor('n')).toBe(false);
  });
});
