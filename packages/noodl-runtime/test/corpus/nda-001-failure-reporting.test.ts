/**
 * NDA-001 corpus — failure-reporting row F1 (defect class D).
 *
 * `Run Tasks` drives its template component entirely by string. It pulses an input literally
 * named `'Do'` (`runtasks.ts:234`) and waits for outputs literally named `'Success'` and
 * `'Failure'` (`runtasks.ts:347-351`). There is no wire between the two, so there is nothing
 * on the canvas that explains the coupling and nothing that can be type-checked.
 *
 * Name the template's output `Done` and the node waits for ever: no success, no failure, no
 * timeout, no warning. The four `sendWarning` calls at `runtasks.ts:246-258` cover "not
 * idle", "no template" and "no items" — the one condition an author actually hits is not
 * among them.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import './expected-failure';

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ComponentInputs = require('../../src/nodes/componentinputs');
import ComponentOutputs = require('../../src/nodes/componentoutputs');
import RunTasksNode = require('../../src/nodes/std-library/runtasks');

interface StarterInstance extends NodeInstance {
  start(): void;
}

const StarterModule: NodeModule = {
  node: {
    name: 'corpus.Starter',
    category: 'Corpus',
    initialize: function (this: NodeInstance) {
      this._internal.items = [{ id: 'one' }, { id: 'two' }];
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

/**
 * A Run Tasks node over a two-item list, with a task template whose completion signal is
 * called `signalName`.
 *
 * The template is the smallest one that can finish: Component Inputs' `Do` wired straight to
 * Component Outputs' completion port.
 */
async function runTasksWithTemplateOutput(signalName: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StarterModule, RunTasksNode as unknown as NodeModule, ComponentInputs, ComponentOutputs],
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
            { name: signalName, plug: 'output', type: 'signal' }
          ],
          nodes: [
            { id: 'task-in', type: 'Component Inputs', ports: [{ name: 'Do', plug: 'output', type: 'signal' }] },
            {
              id: 'task-out',
              type: 'Component Outputs',
              ports: [{ name: signalName, plug: 'input', type: 'signal' }]
            }
          ],
          connections: [
            { sourceId: 'task-in', sourcePort: 'Do', targetId: 'task-out', targetPort: signalName }
          ]
        }
      ]
    } as never
  });

  await graph.settle(3);
  graph.node<StarterInstance>('starter').start();
  await graph.settle(6);
  return graph;
}

describe('NDA-001 F1: Run Tasks and a template that does not spell Success', () => {
  // ✅ Pinned control. Without this, the failing test below could not tell "the contract was
  // violated silently" apart from "the harness never started the tasks".
  test('F1 (pinned control): a template whose output is named Success completes the run', async () => {
    const graph = await runTasksWithTemplateOutput('Success');

    expect(graph.signalsFor('runner')).toEqual(['success', 'done']);
  });

  // ✅ Green since NDA-004 §1: `startTask` checks the template for a completion port the
  // moment the first task component exists, and reports through the runtime error channel —
  // which the editor's warning adapter subscribes to, so the assertion below still reads the
  // warning list. The same report now also reaches a deployed app, which is the point.
  test('F1: a template whose output is named Done produces a warning', async () => {
    const graph = await runTasksWithTemplateOutput('Done');

    expect(graph.editorConnection.warnings.map((warning) => warning.nodeId)).toContain('runner');
    expect(graph.editorConnection.warnings.map((warning) => warning.key)).toContain(
      'run-tasks/no-completion-output'
    );
  });

  /**
   * The same silence, stated as the author experiences it: the run starts, and then nothing
   * ever happens again. Kept separate from the warning assertion because the two are
   * different fixes — one is "tell me", the other is "do not hang".
   */
  test('F1 (corollary): a mis-named template output does not leave the run hung for ever', async () => {
    const graph = await runTasksWithTemplateOutput('Done');
    await graph.settle(20);

    // `failure` then `done`: an author who wired either one gets to react. A hang is the one
    // outcome downstream cannot respond to at all.
    expect(graph.signalsFor('runner')).toEqual(['failure', 'done']);
  });
});
