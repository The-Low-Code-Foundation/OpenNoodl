/**
 * NDA-009 §2 + §3 — the template contract as configuration, and per-task failure reporting.
 *
 * §2 turned the three port names Run Tasks matches by string into node inputs. §3 made a
 * failing task say *which* item failed, and — if the template can say — why.
 *
 * These are **K-rows**, driven through a real graph rather than through the editor-time check
 * (I-rows) or the module's `setup` (J-rows), which live in `nda-009-run-tasks-template.test.ts`.
 * The split is this phase's own rule: testing the check is not testing that the runtime obeys
 * the same table.
 *
 * Two harness facts govern what is asserted here:
 *
 *  - **`graph.signalsFor` does not prove a port exists** — it records the name before
 *    delegating, and `sendSignalOnOutput` on a name the node lacks only logs. Rows about the
 *    *ports* pair it with `hasOutput`/`hasInput`.
 *  - **The failure channel is the observable, not `console`.** `graph.errors` carries the raised
 *    events with their codes; `editorConnection.warnings` sees only the message.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ComponentInputs = require('../../src/nodes/componentinputs');
import ComponentOutputs = require('../../src/nodes/componentoutputs');
import RunTasksNode = require('../../src/nodes/std-library/runtasks');

interface StarterInstance extends NodeInstance {
  start(): void;
}

/** Emits a fixed item list and a `go` pulse. `items` is settable so a row can size the run. */
function starterModule(items: unknown[]): NodeModule {
  return {
    node: {
      name: 'corpus.Starter',
      category: 'Corpus',
      initialize: function (this: NodeInstance) {
        this._internal.items = items;
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
}

interface TemplateShape {
  /** The signal input the template exposes, i.e. what it expects to be pulsed. */
  startPort: string;
  /** The completion signal it raises, wired straight from `startPort`. */
  completionPort: string;
  /** An optional value output, and the value it reports. */
  errorPort?: { name: string; value: unknown };
}

interface RunOptions {
  items?: unknown[];
  /** Parameters on the Run Tasks node, over `taskTemplate`. */
  parameters?: Record<string, unknown>;
  template: TemplateShape;
}

/**
 * A Run Tasks node over `items`, with a template of the given shape.
 *
 * The template is the smallest one that can finish: Component Inputs' start port wired
 * straight to Component Outputs' completion port, plus — when asked for — a constant-valued
 * output standing in for whatever an author's task would put there.
 */
async function runTasks(options: RunOptions): Promise<CorpusGraph> {
  const items = options.items || [{ id: 'one' }, { id: 'two' }];
  const { startPort, completionPort, errorPort } = options.template;

  const templatePorts: Array<{ name: string; plug: string; type: string }> = [
    { name: startPort, plug: 'input', type: 'signal' },
    { name: completionPort, plug: 'output', type: 'signal' }
  ];
  const outPorts: Array<{ name: string; plug: string; type: string }> = [
    { name: completionPort, plug: 'input', type: 'signal' }
  ];
  const connections: Array<{ sourceId: string; sourcePort: string; targetId: string; targetPort: string }> = [
    { sourceId: 'task-in', sourcePort: startPort, targetId: 'task-out', targetPort: completionPort }
  ];

  const nodes: Array<Record<string, unknown>> = [
    { id: 'task-in', type: 'Component Inputs', ports: [{ name: startPort, plug: 'output', type: 'signal' }] }
  ];

  if (errorPort) {
    templatePorts.push({ name: errorPort.name, plug: 'output', type: 'string' });
    outPorts.push({ name: errorPort.name, plug: 'input', type: 'string' });
    nodes.push({
      id: 'task-error',
      type: 'corpus.Constant',
      parameters: { value: errorPort.value }
    });
    connections.push({
      sourceId: 'task-error',
      sourcePort: 'value',
      targetId: 'task-out',
      targetPort: errorPort.name
    });
  }

  nodes.push({ id: 'task-out', type: 'Component Outputs', ports: outPorts });

  const ConstantModule: NodeModule = {
    node: {
      name: 'corpus.Constant',
      category: 'Corpus',
      inputs: {
        value: {
          type: '*',
          set: function (this: NodeInstance, value: unknown) {
            this._internal.value = value;
            this.flagOutputDirty('value');
          }
        }
      },
      outputs: {
        value: {
          type: '*',
          getter: function (this: NodeInstance) {
            return this._internal.value;
          }
        }
      }
    }
  };

  const graph = await createCorpusGraph({
    modules: [
      starterModule(items),
      ConstantModule,
      RunTasksNode as unknown as NodeModule,
      ComponentInputs,
      ComponentOutputs
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'starter', type: 'corpus.Starter' },
            {
              id: 'runner',
              type: 'RunTasks',
              parameters: { taskTemplate: '/Task', ...(options.parameters || {}) }
            }
          ],
          connections: [
            { sourceId: 'starter', sourcePort: 'items', targetId: 'runner', targetPort: 'items' },
            { sourceId: 'starter', sourcePort: 'go', targetId: 'runner', targetPort: 'run' }
          ]
        },
        { name: '/Task', ports: templatePorts, nodes, connections }
      ]
    } as never
  });

  await graph.settle(3);
  graph.node<StarterInstance>('starter').start();
  await graph.settle(8);
  return graph;
}

describe('NDA-009 §2: the template contract is configuration, not three literals', () => {
  /**
   * The whole of §2 in one row. Under the old code this template is the F1 defect — a
   * completion signal called `Finished` that nothing ever matches — and the run either hangs
   * or is ended by NDA-004's backstop. Configured, it is an ordinary successful run.
   */
  test('K1: a template using its own port names completes when the node is told them', async () => {
    const graph = await runTasks({
      parameters: { taskStartInput: 'Begin', taskSuccessOutput: 'Finished' },
      template: { startPort: 'Begin', completionPort: 'Finished' }
    });

    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  /**
   * The control that makes K1 mean something. Same template, node left at its defaults: the
   * names no longer match, and the run must *not* silently succeed. Without this row K1 would
   * pass equally well if the node had stopped matching names at all.
   */
  test('K2 (control): the same template with the node left at its defaults cannot complete', async () => {
    const graph = await runTasks({
      template: { startPort: 'Begin', completionPort: 'Finished' }
    });

    // ⚠️ This assertion used to read `not.toContain('success')`, and ERG-001's rename would have
    // left it **vacuously true** — the node has no `success` port any more, so the check would
    // pass whatever the node did. A control that cannot fail is the "a sweep returning zero
    // looks the same clean or broken" shape, so it is restated positively as well as negatively:
    // the run must end in `Failure`, and must not report the successful outcome under its new
    // name either.
    expect(graph.signalsFor('runner')).toEqual(['failure', 'completed']);
    expect(graph.signalsFor('runner')).not.toContain('done');
    expect(graph.errors.map((e) => e.code)).toContain('run-tasks/no-completion-output');
  });

  /**
   * The defaults are the contract's, not a second copy. A node with no contract parameters at
   * all behaves exactly as it did before §2 — which is the compatibility claim, and the one a
   * later "tidy the defaults" edit would break.
   */
  test('K3: an unconfigured node still matches Do/Success/Failure', async () => {
    const graph = await runTasks({ template: { startPort: 'Do', completionPort: 'Success' } });

    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
  });

  /**
   * An emptied field is a deletion, and the only non-broken reading of "match a port with no
   * name" is the default. Pinned because the phase's Empty-Value work makes the opposite
   * reading — honour the absence — the reflex, and here it would leave the node matching
   * nothing at all.
   */
  test('K4: an emptied contract field falls back to the default rather than matching nothing', async () => {
    const graph = await runTasks({
      parameters: { taskStartInput: '', taskSuccessOutput: '' },
      template: { startPort: 'Do', completionPort: 'Success' }
    });

    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
  });

  /**
   * The configured start name has to reach the `isInputConnected` override too, not just the
   * pulse. That override is what stops the template's own start action running at creation
   * time; missed, the task runs twice and the second completion arrives after the node is gone.
   */
  test('K5: the configured start input is the one reported as connected inside the template', async () => {
    const graph = await runTasks({
      items: [{ id: 'only' }],
      parameters: { taskStartInput: 'Begin', taskSuccessOutput: 'Finished' },
      template: { startPort: 'Begin', completionPort: 'Finished' }
    });

    // One completion for one item — a double-pulse shows up here as `success` twice, or as a
    // count mismatch that leaves the run hung.
    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
  });

  /**
   * §2's ports must be visible to anything that reads the node's declared inputs — the catalog,
   * the register, and `nonexistentPort`. This is the row that fails if a later change moves
   * them to `sendDynamicPorts`, which is the design decision the node's comment records: a
   * dynamic-port node has its port checks *skipped* by the validator, which is the opposite of
   * criterion 4.
   */
  test('K6: the four contract names are declared inputs, not runtime-created ones', async () => {
    const graph = await runTasks({ template: { startPort: 'Do', completionPort: 'Success' } });
    const runner = graph.node('runner');

    for (const port of ['taskStartInput', 'taskSuccessOutput', 'taskFailureOutput', 'taskErrorOutput']) {
      expect(runner.hasInput(port)).toBe(true);
    }
  });
});

describe('NDA-009 §3: which task failed, and why', () => {
  /**
   * The headline. One bad item in three, and the report names its position and its record —
   * the two things that let an author find it again. Before §3 the only observable was the
   * aggregate `failure` signal, which says a batch of any size went wrong.
   */
  test('K7: a failing task is reported with the item that caused it', async () => {
    // Two fields per item, and the reason is a fixture mistake this row made first:
    // `Model.create` consumes `id` as the *record id* and skips it when copying
    // (`model.ts:230-238`), so items whose only field is `id` produce an empty `data` and a
    // row asserting on `item` alone reads as a defect in the reporting. `itemId` and `item`
    // are two halves of the identity, and both are asserted.
    const graph = await runTasks({
      items: [
        { id: 'a', label: 'first' },
        { id: 'b', label: 'second' },
        { id: 'c', label: 'third' }
      ],
      parameters: { taskSuccessOutput: 'never-sent' },
      template: { startPort: 'Do', completionPort: 'Failure' }
    });

    const failures = graph.errors.filter((e) => e.code === 'run-tasks/task-failed');
    expect(failures).toHaveLength(3);

    const detail = failures[0].detail as { itemIndex: number; itemId: unknown; item: unknown };
    expect(detail.itemIndex).toBe(0);
    expect(detail.itemId).toBe('a');
    expect(detail.item).toMatchObject({ label: 'first' });

    // Every item is reported under its own position and its own id, not all under the first.
    expect(failures.map((f) => (f.detail as { itemIndex: number }).itemIndex).sort()).toEqual([0, 1, 2]);
    expect(failures.map((f) => (f.detail as { itemId: string }).itemId).sort()).toEqual(['a', 'b', 'c']);
  });

  /**
   * The message is what an author reads on the node, so the identity has to be in it and not
   * only in `detail` — the editor's warning adapter carries the message alone.
   */
  test('K8: the position is in the message, not only in the detail', async () => {
    const graph = await runTasks({
      items: [{ id: 'a' }, { id: 'b' }],
      parameters: { taskSuccessOutput: 'never-sent' },
      template: { startPort: 'Do', completionPort: 'Failure' }
    });

    const messages = graph.errors.filter((e) => e.code === 'run-tasks/task-failed').map((e) => e.message);
    expect(messages).toContain('Task 1 of 2 failed');
    expect(messages).toContain('Task 2 of 2 failed');
  });

  /**
   * "Why" comes from the template, because `Failure` is a bare signal and cannot carry it.
   * A template with an output under the configured error name has its value attached.
   */
  test('K9: the template’s error output is attached when it has one', async () => {
    const graph = await runTasks({
      items: [{ id: 'a' }],
      parameters: { taskSuccessOutput: 'never-sent' },
      template: { startPort: 'Do', completionPort: 'Failure', errorPort: { name: 'Error', value: 'row 3 is null' } }
    });

    const failure = graph.errors.find((e) => e.code === 'run-tasks/task-failed');
    expect(failure).toBeDefined();
    expect((failure!.detail as { error: unknown }).error).toBe('row 3 is null');
    expect(failure!.message).toContain('row 3 is null');
  });

  /**
   * And a template that cannot explain itself still reports, with identity alone. This is the
   * row that stops the error output becoming a fourth required port — a task component with no
   * way to say why is a legitimate shape, so its absence must produce a report, not a warning
   * and not a `<undefined>` in the message.
   */
  test('K10 (control): a template with no error output still reports, without inventing a reason', async () => {
    const graph = await runTasks({
      items: [{ id: 'a' }],
      parameters: { taskSuccessOutput: 'never-sent' },
      template: { startPort: 'Do', completionPort: 'Failure' }
    });

    const failure = graph.errors.find((e) => e.code === 'run-tasks/task-failed');
    expect(failure).toBeDefined();
    expect(failure!.message).toBe('Task 1 of 1 failed');
    expect((failure!.detail as { error: unknown }).error).toBeUndefined();

    // No contract warning either: the error port is optional by design.
    expect(graph.errors.map((e) => e.code)).not.toContain('run-tasks/no-completion-output');
  });

  /**
   * A run that succeeds raises nothing. Asserting the absence is only meaningful because the
   * rows above show the same fixture *does* raise when a task fails — the phase's B-x lesson:
   * a control that asserts an absence in a state where the code never runs proves nothing.
   */
  test('K11 (control): a successful run raises no per-task failure', async () => {
    const graph = await runTasks({
      items: [{ id: 'a' }, { id: 'b' }],
      template: { startPort: 'Do', completionPort: 'Success' }
    });

    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
    expect(graph.errors.map((e) => e.code)).not.toContain('run-tasks/task-failed');
  });
});
