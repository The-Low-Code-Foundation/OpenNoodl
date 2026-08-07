/**
 * NDA-015 §2 / FINDINGS F-ii — the fifth `_forEachModel` site, and the only lazy one.
 *
 * `javascriptnodeparser.getComponentScopeForNode` builds the `Component` object every Function
 * node's script receives, and `Component.RepeaterObject` was the fifth hand-copy of the walk:
 * a silent `undefined` when nothing was found, exactly like the four node-side copies.
 *
 * It cannot be fixed the same way as the other four, and that is what these rows pin. The
 * node-side copies resolve because an author set `Id Source = From repeater` — a statement of
 * intent, so a miss is worth raising. This one is computed for **every** Function node in the
 * project, whether or not its script ever mentions `RepeaterObject`. Raising eagerly would file
 * a failure against every Function node in every non-repeated component in the project, which
 * is how a diagnostic channel gets ignored. So the property is a getter, and the report happens
 * only if a script actually asks.
 *
 * These rows also pin the **second producer**: `Run Tasks` sets `_forEachModel` with the same
 * `createNode` extraProps shape as the Repeater, so "the current item" is not a Repeater-only
 * idea and the messages must not claim it is.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ComponentInputs = require('../../src/nodes/componentinputs');
import ComponentOutputs = require('../../src/nodes/componentoutputs');
import RunTasksNode = require('../../src/nodes/std-library/runtasks');
import JavascriptNodeParser = require('../../src/javascriptnodeparser');

interface StarterInstance extends NodeInstance {
  start(): void;
}

const StarterModule: NodeModule = {
  node: {
    name: 'corpus.Starter',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      this._internal.items = [{ id: 'task-item' }];
    },
    outputs: {
      items: {
        type: 'array',
        getter: function (this: NodeInstance) {
          return this._internal.items;
        }
      },
      go: { type: 'signal' }
    },
    methods: {
      start(this: NodeInstance) {
        this.flagOutputDirty('items');
        this.sendSignalOnOutput('go');
      }
    }
  }
};

/** A node that stands in for a Function node — `getComponentScopeForNode` takes any node. */
const MarkerModule: NodeModule = {
  node: { name: 'corpus.Marker', category: 'Corpus' }
};

/** A Run Tasks run over one item, with a marker node inside the task template. */
async function runTasksGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StarterModule, MarkerModule, RunTasksNode as unknown as NodeModule, ComponentInputs, ComponentOutputs],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'starter', type: 'corpus.Starter' },
            { id: 'runner', type: 'RunTasks', parameters: { taskTemplate: '/Task' } }
          ],
          connections: [
            { sourceId: 'starter', sourcePort: 'items', targetId: 'runner', targetPort: 'items' },
            { sourceId: 'starter', sourcePort: 'go', targetId: 'runner', targetPort: 'run' }
          ]
        },
        {
          name: '/Task',
          ports: [
            { name: 'Do', plug: 'input', type: 'signal' },
            { name: 'Success', plug: 'output', type: 'signal' }
          ],
          nodes: [
            { id: 'task-in', type: 'Component Inputs', ports: [{ name: 'Do', plug: 'output', type: 'signal' }] },
            { id: 'task-marker', type: 'corpus.Marker' },
            { id: 'task-out', type: 'Component Outputs', ports: [{ name: 'Success', plug: 'input', type: 'signal' }] }
          ],
          // `Do` is deliberately **not** wired to `Success`, so the task never completes and
          // its component instance stays mounted for the assertions below. A completed run
          // tears the task component down, taking the node this row needs to ask with it.
          // The template still declares a `Success` port, so NDA-004's completion-port check
          // is satisfied and this row does not trip an unrelated failure.
          connections: []
        }
      ]
    } as never
  });

  await graph.settle(3);
  graph.node<StarterInstance>('starter').start();
  await graph.settle(6);
  return graph;
}

/** A plain component with a marker node and no repeater of any kind above it. */
async function plainGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [MarkerModule],
    rootComponent: '/root',
    data: {
      components: [{ name: '/root', nodes: [{ id: 'task-marker', type: 'corpus.Marker' }], connections: [] }]
    } as never
  });

  await graph.settle(3);
  return graph;
}

describe('NDA-015 §2 / F-ii: Component.RepeaterObject in a Function node', () => {
  test('reading it outside any repeater raises rather than handing back undefined', async () => {
    const graph = await plainGraph();

    const scope = JavascriptNodeParser.getComponentScopeForNode(graph.node('task-marker'));
    // The read is the trigger. Before this, the script got `undefined` and the author got
    // nothing — the same silent miss as the four node-side copies.
    expect(scope.RepeaterObject).toBeUndefined();
    expect(graph.errors.map((e) => e.code)).toContain('repeater-item/no-item-in-scope');
  });

  test('building the scope without reading it raises nothing', async () => {
    const graph = await plainGraph();

    // The row that justifies the getter. `getComponentScopeForNode` runs for every Function
    // node in the project; if it resolved eagerly, every Function node outside a Repeater
    // would file a failure it never asked about.
    JavascriptNodeParser.getComponentScopeForNode(graph.node('task-marker'));

    expect(graph.errors).toEqual([]);
  });

  test('a Run Tasks template is a repeater item too — the second producer', async () => {
    const graph = await runTasksGraph();

    const scope = JavascriptNodeParser.getComponentScopeForNode(graph.node('task-marker'));

    // `runtasks.ts` sets `_forEachModel` exactly as the Repeater does. A script inside a task
    // template must therefore see its item, and must not be told it is "not in a Repeater".
    expect(scope.RepeaterObject).toBeDefined();
    expect(scope.RepeaterObject.getId()).toBe('task-item');
    expect(graph.errors.map((e) => e.code)).not.toContain('repeater-item/no-item-in-scope');
  });
});
