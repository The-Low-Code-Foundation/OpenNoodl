/**
 * NDA-004 §3 — the runtime-side nodes that used to take a signal and emit none.
 *
 * The Function node is the one that mattered most, and most of this file is about it.
 *
 * A `Function` that could not signal "done" forced authors into timing hacks: a `Delay` node
 * set long enough to *probably* cover an async call, because there was no other way to
 * sequence anything after it. `Run` went in and nothing came out.
 *
 * The reserved-name problem the spec flags turns out to solve itself, which is the fact worth
 * pinning here: every author-declared output is registered as `'out-' + name`, so a built-in
 * port without that prefix is unreachable from user code and cannot be collided with. A
 * script that writes `Outputs.success = 'mine'` still writes to its own `out-success`.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../corpus/graph-harness';

import SimpleJavascriptNode = require('../../src/nodes/std-library/simplejavascript');

async function functionGraph(script: string, outputPorts: string[] = []): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [SimpleJavascriptNode as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'fn',
              type: 'JavaScriptFunction',
              parameters: { functionScript: script },
              ports: outputPorts.map((name) => ({ name: 'out-' + name, plug: 'output', type: 'string' }))
            }
          ],
          connections: []
        }
      ]
    } as never
  });

  await graph.settle(2);
  return graph;
}

function run(graph: CorpusGraph): void {
  graph.node('fn').setInputValue('run', true);
}

describe('NDA-004 §3: Function completion signals', () => {
  test('a script that finishes signals Success', async () => {
    const graph = await functionGraph('Outputs.value = Inputs.a;');

    run(graph);
    await graph.settle(4);

    expect(graph.signalsFor('fn')).toContain('success');
    expect(graph.signalsFor('fn')).not.toContain('failure');
  });

  /**
   * The reason the port exists. `await`ing the script means an `async` body signals when it
   * has actually finished rather than when it was started — the difference the guessed
   * `Delay` was standing in for.
   */
  test('an async script signals Success only after it resolves', async () => {
    const graph = await functionGraph(
      'await new Promise((resolve) => setTimeout(resolve, 20)); Outputs.value = "done";'
    );

    run(graph);
    await graph.settle(1);
    expect(graph.signalsFor('fn')).not.toContain('success');

    await new Promise((resolve) => setTimeout(resolve, 40));
    await graph.settle(2);
    expect(graph.signalsFor('fn')).toContain('success');
  });

  test('a script that throws signals Failure and carries the message on Error', async () => {
    const graph = await functionGraph('throw new Error("deliberate");');

    run(graph);
    await graph.settle(4);

    expect(graph.signalsFor('fn')).toContain('failure');
    expect(graph.signalsFor('fn')).not.toContain('success');
    expect(graph.node('fn').getOutput('error').value).toBe('deliberate');
  });

  test('a throw is reported on the runtime error channel, not only to the editor', async () => {
    const graph = await functionGraph('throw new Error("deliberate");');

    run(graph);
    await graph.settle(4);

    expect(graph.editorConnection.warnings.map((w) => w.key)).toContain('function/script-threw');
  });

  /**
   * The collision guard, stated as a test. An author output called `success` is registered
   * as `out-success` and is a different port from the built-in `success` signal.
   */
  test('an author output named success does not collide with the built-in signal', async () => {
    const graph = await functionGraph('Outputs.success = "mine";', ['success']);

    run(graph);
    await graph.settle(4);

    const fn = graph.node('fn');
    expect(fn.getOutput('out-success').value).toBe('mine');
    // Two distinct ports: the author's value output, and the built-in signal that fired.
    expect(fn.hasOutput('success')).toBe(true);
    expect(fn.hasOutput('out-success')).toBe(true);
    expect(graph.signalsFor('fn')).toContain('success');
  });
});

/**
 * NDA-004 §3 — Unique Id.
 *
 * `Id` is a value output, so a graph that wanted to *act* on a fresh id had nothing to
 * trigger on: the node took `New` and emitted no signal at all.
 */
describe('NDA-004 §3: Unique Id completion signal', () => {
  test('New generates a fresh id and announces it', async () => {
    const UniqueIdNode = require('../../src/nodes/std-library/uniqueid');
    const graph = await createCorpusGraph({
      modules: [UniqueIdNode as unknown as NodeModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'uid', type: 'Unique Id' }], connections: [] }]
      } as never
    });
    await graph.settle(2);

    const before = graph.node('uid').getOutput('guid').value;
    expect(graph.signalsFor('uid')).toEqual([]);

    graph.node('uid').setInputValue('new', true);
    await graph.settle(2);

    expect(graph.node('uid').getOutput('guid').value).not.toBe(before);
    // ERG-001 §4 renamed `generated` to `done` and added `Completed` beside it.
    expect(graph.signalsFor('uid')).toEqual(['done', 'completed']);
  });
});
