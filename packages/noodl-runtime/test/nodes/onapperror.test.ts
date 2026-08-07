/**
 * `On App Error` — the Failure Contract's global error boundary.
 *
 * What is worth pinning here is the *boundary* behaviour rather than the port plumbing: that
 * it catches errors raised by nodes nobody wired, that several boundaries all fire (it is not
 * a handler chain), that a filter narrows without swallowing, and that a deleted one stops
 * listening. The last matters more than it looks — a boundary that keeps its subscription
 * after deletion would fire from a node that no longer exists, on a graph that has moved on.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../corpus/graph-harness';

import OnAppErrorNode = require('../../src/nodes/std-library/onapperror');

interface FailerInstance extends NodeInstance {
  fail(code: string, message: string): void;
}

/** A node whose entire purpose is to go wrong on demand. */
const FailerModule: NodeModule = {
  node: {
    name: 'test.Failer',
    category: 'Test',
    inputs: {},
    outputs: {},
    methods: {
      fail(this: NodeInstance, code: string, message: string) {
        this.raiseRuntimeError(code, message, { from: 'test.Failer' });
      }
    }
  }
};

async function graphWithBoundaries(boundaries: Array<{ id: string; filter?: string }>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [FailerModule, OnAppErrorNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'failer', type: 'test.Failer' },
            ...boundaries.map((b) => ({
              id: b.id,
              type: 'On App Error',
              parameters: b.filter === undefined ? {} : { filter: b.filter }
            }))
          ],
          connections: []
        }
      ]
    } as never
  });

  await graph.settle(2);
  return graph;
}

describe('On App Error', () => {
  test('fires for an error raised by a node it is not wired to', async () => {
    const graph = await graphWithBoundaries([{ id: 'boundary' }]);

    graph.node<FailerInstance>('failer').fail('test/broke', 'It broke');
    await graph.settle(2);

    expect(graph.signalsFor('boundary')).toEqual(['error']);

    const boundary = graph.node('boundary');
    expect(boundary.getOutput('message').value).toBe('It broke');
    expect(boundary.getOutput('code').value).toBe('test/broke');
    expect(boundary.getOutput('nodeId').value).toBe('failer');
    expect(boundary.getOutput('nodeType').value).toBe('test.Failer');
    expect(boundary.getOutput('componentName').value).toBe('/root');
  });

  test('the Error Object output carries the whole structured event', async () => {
    const graph = await graphWithBoundaries([{ id: 'boundary' }]);

    graph.node<FailerInstance>('failer').fail('test/broke', 'It broke');
    await graph.settle(2);

    expect(graph.node('boundary').getOutput('errorObject').value).toMatchObject({
      nodeId: 'failer',
      componentName: '/root',
      nodeType: 'test.Failer',
      code: 'test/broke',
      message: 'It broke',
      detail: { from: 'test.Failer' }
    });
  });

  /** A boundary, not a handler chain: there is no claiming, so every instance sees it. */
  test('every instance fires — one does not consume the error', async () => {
    const graph = await graphWithBoundaries([{ id: 'first' }, { id: 'second' }]);

    graph.node<FailerInstance>('failer').fail('test/broke', 'It broke');
    await graph.settle(2);

    expect(graph.signalsFor('first')).toEqual(['error']);
    expect(graph.signalsFor('second')).toEqual(['error']);
  });

  test('a filter narrows by code prefix, and does not stop an unfiltered boundary', async () => {
    const graph = await graphWithBoundaries([
      { id: 'narrow', filter: 'run-tasks/' },
      { id: 'wide' }
    ]);

    graph.node<FailerInstance>('failer').fail('test/broke', 'Not the one');
    await graph.settle(2);

    expect(graph.signalsFor('narrow')).toEqual([]);
    expect(graph.signalsFor('wide')).toEqual(['error']);

    graph.node<FailerInstance>('failer').fail('run-tasks/no-completion-output', 'The one');
    await graph.settle(2);

    expect(graph.signalsFor('narrow')).toEqual(['error']);
    expect(graph.signalsFor('wide')).toEqual(['error', 'error']);
  });

  test('a deleted boundary stops listening', async () => {
    const graph = await graphWithBoundaries([{ id: 'boundary' }]);
    const boundary = graph.node('boundary');

    boundary.nodeScope.deleteNode(boundary);

    graph.node<FailerInstance>('failer').fail('test/broke', 'It broke');
    await graph.settle(2);

    expect(graph.signalsFor('boundary')).toEqual([]);
  });

  /**
   * The realistic end-to-end: a genuinely broken graph, caught by a boundary nobody wired to
   * the failing node. This is the shape the contract exists for.
   */
  test('catches a real node failure — Run Tasks with an uncompletable template', async () => {
    const graph = await createCorpusGraph({
      modules: [
        OnAppErrorNode as unknown as NodeModule,
        require('../../src/nodes/std-library/runtasks') as NodeModule,
        require('../../src/nodes/componentinputs') as NodeModule,
        require('../../src/nodes/componentoutputs') as NodeModule,
        FailerModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'boundary', type: 'On App Error' },
              { id: 'runner', type: 'RunTasks', parameters: { taskTemplate: '/Task' } }
            ],
            connections: []
          },
          {
            name: '/Task',
            ports: [
              { name: 'Do', plug: 'input', type: 'signal' },
              { name: 'Done', plug: 'output', type: 'signal' }
            ],
            nodes: [
              { id: 'task-in', type: 'Component Inputs', ports: [{ name: 'Do', plug: 'output', type: 'signal' }] },
              { id: 'task-out', type: 'Component Outputs', ports: [{ name: 'Done', plug: 'input', type: 'signal' }] }
            ],
            connections: [{ sourceId: 'task-in', sourcePort: 'Do', targetId: 'task-out', targetPort: 'Done' }]
          }
        ]
      } as never
    });

    await graph.settle(3);
    const runner = graph.node('runner');
    runner.setInputValue('items', [{ id: 'one' }]);
    runner.setInputValue('run', true);
    await graph.settle(6);

    expect(graph.signalsFor('boundary')).toEqual(['error']);
    expect(graph.node('boundary').getOutput('code').value).toBe('run-tasks/no-completion-output');
  });
});
