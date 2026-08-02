/**
 * ERG-001 §4 — the long tail's `noodl-runtime` nodes: `Unique Id`, `Condition`, and the three
 * CustomCode script hosts.
 *
 * | Node | Action port | Shape |
 * |---|---|---|
 * | `Unique Id` | `New` | `done` (was `generated`) · `completed` — no `Failure`, no `Unchanged` |
 * | `Condition` | `Evaluate` | `done` **added** · `completed` — no `Failure`, no `Unchanged` |
 * | `Expression` | `Run` | `done` **added** · `failure` kept · `completed` |
 * | `JavaScriptFunction` — Function | `Run` | `done` **added** · `unchanged` · `failure` kept · `completed` |
 * | `Logic Builder` | `Run`, each block-declared signal input | `done` **added** · `unchanged` · `failure` kept · `completed` |
 *
 * ## ⚠️ The script hosts add beside, and keep every port they had
 *
 * `Condition`'s `On True`/`On False`, `Expression`'s `On True`/`On False` and `Function`'s
 * `Success` all fire from paths **no author invoked** — a value arriving at a ticked input, and
 * on the two script hosts the `expression`/`functionScript` setter at load. Renamed, they would
 * fire `Done` on the boot path while `Completed`, which only an invocation may emit, stayed
 * silent; `Done` and `Completed` diverging on a node doing nothing wrong is Rule 2 broken in the
 * one place its whole value lies. So the contract's ports go **beside** them and only the action
 * port mints, which is `For Each`'s recorded answer for the seventh and eighth time.
 *
 * ⚠️ `Logic Builder` is the one where the grep comes out clean — every route into
 * `_executeLogic` is a signal input port — and it *still* keeps `Success`. The four script hosts
 * are a documented family, and splitting it so three say `Success` and one does not is the
 * per-node divergence `outcome.ts`'s docstring exists to prevent. The cost is recorded rather
 * than hidden: on this node the two co-fire on every successful run.
 *
 * ## ⚠️ `failure` is one port doing two jobs, so it is not doubled
 *
 * On all three script hosts `failure` is both the invocation's outcome *and* a value-level
 * announcement, so a port-driven run must not pulse it twice. Where there are tokens,
 * `reportOutcome` owns the pulse; where there are none, the existing announcement stands. The
 * raise keeps its message dedup — an author mid-keystroke would otherwise raise once per
 * character — and the tokens settle **outside** it, because Rule 1 is per invocation: a second
 * `Run` over the same broken script still owes its own `Failure` and `Completed`.
 *
 * ## Two more dead chains closed
 *
 * `Function` with no script written yet, and `Logic Builder` with no blocks yet, both took `Run`
 * and returned bare. Each is now `Unchanged` — the node was asked to run a program it does not
 * have, which is not a failure of anything and must not raise, but it is not silence either.
 *
 * ## ⚠️ `Generated` is a rename, and the grep is why
 *
 * `sendSignalOnOutput('generated')` has exactly one caller: the `new` port's own
 * `valueChangedToTrue`. No setter route, no subscription — so `Generated` *is* this
 * invocation's outcome, and §0.2 Result 2's "eight ports displaying Done under four wire
 * names" gets one fewer name rather than one more port.
 *
 * ## No `Failure` and no `Unchanged`
 *
 * `Model.guid()` cannot fail and cannot return the id the node already holds, so both ports
 * would be dead ends of exactly the kind §5's check exists to complain about. "A node that
 * cannot fail gets no `Failure` port" — NDA-004 established it and the contract keeps it.
 *
 * ## What reverting reddens — predicted per fixture, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Unique Id` reports `done` before `flagOutputDirty('guid')` | **0** — nothing here observes both in one frame; recorded as an honest non-discrimination |
 * | the `new` handler stops minting a token | 3 — the two `Unique Id` counting rows plus `completion-signals.test.ts`'s exact-array row |
 * | `Condition`'s token minted in `scheduleEvaluate` rather than at `Evaluate` | 2 — the value-arrival row and the coalescing row |
 * | `Condition` reporting `done` before `ontrue`/`onfalse` | 1 — the ordering row |
 * | `Expression`'s token minted in `_scheduleEvaluateExpression` | 2 — the value-arrival row and the two-Runs row |
 * | `Expression`'s tokens settled *inside* `_reportFailure`'s dedup | 1 — the repeated-failure row |
 * | `Function`'s no-script branch back to a bare return | 1 — the no-script row |
 * | `Function`'s token minted in `scheduleRun` | 2 — the value-arrival row and the script-setter row |
 * | `Logic Builder`'s no-blocks branch back to a bare return | 1 — the no-blocks row |
 * | `Logic Builder` not reserving the three contract names | 1 — the reserved-name row |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ConditionModule = require('../../src/nodes/std-library/condition');
import ExpressionModule = require('../../src/nodes/std-library/expression');
import LogicBuilderModule = require('../../src/nodes/std-library/logic-builder');
import SimpleJavascriptModule = require('../../src/nodes/std-library/simplejavascript');
import UniqueIdModule = require('../../src/nodes/std-library/uniqueid');

/** The terminal outcomes a node reported, from a mark. */
function outcomesOf(graph: CorpusGraph, id: string, from = 0): string[] {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, signal: string, from = 0): number {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === signal).length;
}

function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** Every signal-typed output a definition declares, by wire name. */
function signalPortsOf(module: unknown): string[] {
  const outputs = ((module as NodeModule).node as { outputs: Record<string, { type?: unknown }> }).outputs;
  return Object.keys(outputs).filter((name) => {
    const type = outputs[name].type;
    return type === 'signal' || (type && (type as { name?: string }).name === 'signal');
  });
}

// =================================================================================================
// Unique Id
// =================================================================================================

describe('ERG-001 §4: Unique Id', () => {
  async function uniqueIdGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [UniqueIdModule as unknown as NodeModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'node', type: 'Unique Id', parameters: {} }], connections: [] }]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a New reports Done then Completed, and Generated is gone', async () => {
    const graph = await uniqueIdGraph();
    pulse(graph, 'node', 'new');
    await graph.settle(3);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(signals).not.toContain('generated');
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('the id really changed, and nothing was raised', async () => {
    const graph = await uniqueIdGraph();
    const before = (graph.node('node')._internal as { guid: string }).guid;

    pulse(graph, 'node', 'new');
    await graph.settle(3);

    expect((graph.node('node')._internal as { guid: string }).guid).not.toBe(before);
    expect(graph.errors).toEqual([]);
  });

  test('two News report two outcomes and two Completeds', async () => {
    const graph = await uniqueIdGraph();
    pulse(graph, 'node', 'new');
    await graph.settle(3);
    pulse(graph, 'node', 'new');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('(pinned control) no Failure and no Unchanged — this node can do neither', () => {
    expect(signalPortsOf(UniqueIdModule).sort()).toEqual(['completed', 'done']);
  });
});

// =================================================================================================
// Condition
// =================================================================================================

describe('ERG-001 §4: Condition', () => {
  async function conditionGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [ConditionModule as unknown as NodeModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'node', type: 'Condition', parameters: {} }], connections: [] }]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('an Evaluate reports Done then Completed, after On True', async () => {
    const graph = await conditionGraph();
    graph.node('node').setInputValue('condition', true);
    await graph.settle(3);

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'eval');
    await graph.settle(3);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('ontrue'));
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('a false condition still reports Done — the test ran', async () => {
    const graph = await conditionGraph();
    graph.node('node').setInputValue('condition', false);
    await graph.settle(3);

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'eval');
    await graph.settle(3);

    expect(graph.signalsFor('node').slice(from)).toEqual(['onfalse', 'done', 'completed']);
  });

  /** Only the port mints: a condition arriving is a value arrival, and nobody invoked anything. */
  test('a condition arriving on its own reports no outcome', async () => {
    const graph = await conditionGraph();

    const from = graph.signalsFor('node').length;
    graph.node('node').setInputValue('condition', true);
    await graph.settle(3);

    expect(graph.signalsFor('node').slice(from)).toEqual(['ontrue']);
    expect(outcomesOf(graph, 'node', from)).toEqual([]);
  });

  /**
   * NDA-017 §2 constraint 3 coalesces two triggers in a frame into one *test*, deliberately —
   * and it must not coalesce two invocations into one outcome.
   */
  test('two Evaluates coalesced into one pass still report two outcomes', async () => {
    const graph = await conditionGraph();
    graph.node('node').setInputValue('condition', true);
    await graph.settle(3);

    const from = graph.signalsFor('node').length;
    const node = graph.node('node');
    node.setInputValue('eval', false);
    node.setInputValue('eval', true);
    node.setInputValue('eval', false);
    node.setInputValue('eval', true);
    await graph.settle(3);

    expect(countOf(graph, 'node', 'ontrue', from)).toBe(1);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(2);
  });

  test('(pinned control) no Failure and no Unchanged — a test always tests', () => {
    expect(signalPortsOf(ConditionModule).sort()).toEqual(['completed', 'done', 'onfalse', 'ontrue']);
  });
});

// =================================================================================================
// Expression
// =================================================================================================

describe('ERG-001 §4: Expression', () => {
  async function expressionGraph(expression: string): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [ExpressionModule as unknown as NodeModule],
      data: {
        components: [
          { name: '/root', nodes: [{ id: 'node', type: 'Expression', parameters: { expression } }], connections: [] }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a Run reports Done then Completed, after On True', async () => {
    const graph = await expressionGraph('1 + 1');

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('isTrueEv'));
  });

  /**
   * The boot path. The `expression` setter evaluates at load and announces `On True` — and
   * reports no outcome, because nobody invoked anything.
   */
  test('the load-time evaluation reports no outcome', async () => {
    const graph = await expressionGraph('1 + 1');

    expect(graph.signalsFor('node')).toEqual(['isTrueEv']);
    expect(outcomesOf(graph, 'node')).toEqual([]);
  });

  test('an expression that throws is a Failure carrying its code', async () => {
    const graph = await expressionGraph('a.missing.deeper');
    graph.node('node').setInputValue('a', {});
    await graph.settle(3);

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    // ⚠️ Asserted as a total rather than a slice: the value-driven run that preceded this pulse
    // already put the reason on the channel, and the raise is deduplicated by message on
    // purpose. The pulse owes an *outcome*, not a second raise.
    expect(graph.errors.map((e) => e.code)).toEqual(['expression/threw']);
  });

  /**
   * ⚠️ The row the "settle outside the dedup" rule exists for. The raise is deduplicated by
   * message on purpose — an author mid-keystroke would otherwise raise once per character — but
   * Rule 1 is per invocation, so a second `Run` over the same broken expression still owes its
   * own `Failure` and `Completed`. The raise count stays at one; the outcome count is two.
   */
  test('a repeated Run over the same broken expression reports twice and raises once', async () => {
    const graph = await expressionGraph('a.missing.deeper');
    graph.node('node').setInputValue('a', {});
    await graph.settle(3);

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure', 'failure']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(2);
    // Two invocations, two outcomes — and exactly one raise for the three runs that produced
    // them, which is the dedup doing its job.
    expect(graph.errors.map((e) => e.code)).toEqual(['expression/threw']);
  });

  test('two Runs coalesced into one pass still report two outcomes', async () => {
    const graph = await expressionGraph('1 + 1');

    const from = graph.signalsFor('node').length;
    const node = graph.node('node');
    node.setInputValue('run', false);
    node.setInputValue('run', true);
    node.setInputValue('run', false);
    node.setInputValue('run', true);
    await graph.settle(3);

    expect(countOf(graph, 'node', 'isTrueEv', from)).toBe(1);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(2);
  });

  test('(pinned control) On True and On False survive, and there is no Unchanged', () => {
    expect(signalPortsOf(ExpressionModule).sort()).toEqual([
      'completed',
      'done',
      'failure',
      'isFalseEv',
      'isTrueEv'
    ]);
  });
});

// =================================================================================================
// Function
// =================================================================================================

describe('ERG-001 §4: Function', () => {
  async function functionGraph(script?: string): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [SimpleJavascriptModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              {
                id: 'node',
                type: 'JavaScriptFunction',
                parameters: script === undefined ? {} : { functionScript: script }
              }
            ],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a Run reports Done then Completed, after the existing Success', async () => {
    const graph = await functionGraph('Outputs.value = 1;');

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(4);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('success'));
  });

  /**
   * ⚠️ The dead chain this closes. A freshly dropped Function has no script, and `Run` on it
   * returned bare — no signal, nothing raised, the graph behind it stopped. `Unchanged`, because
   * being asked to run a program the node does not have is not a failure of anything.
   */
  test('a Run with no script written yet is Unchanged, and raises nothing', async () => {
    const graph = await functionGraph();

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(4);

    expect(outcomesOf(graph, 'node', from)).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('a script that throws is a Failure carrying its code', async () => {
    const graph = await functionGraph('throw new Error("deliberate");');

    const from = graph.signalsFor('node').length;
    const errorsBefore = graph.errors.length;
    pulse(graph, 'node', 'run');
    await graph.settle(4);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['function/script-threw']);
  });

  test('a script that will not compile is a Failure carrying its code', async () => {
    const graph = await functionGraph('this is not javascript(');

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(4);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    // As above: the load-time run already raised it, and the raise is deduplicated by message.
    expect(graph.errors.map((e) => e.code)).toEqual(['function/script-not-compiled']);
  });

  /**
   * ⚠️ Only the port mints, and on this node the load path is the one that matters: the
   * `functionScript` setter runs `scheduleRun` at load on every Function in the project whose
   * `Run` is unconnected. It announces `Success` and reports no outcome.
   */
  test('the load-time run announces Success and reports no outcome', async () => {
    const graph = await functionGraph('Outputs.value = 1;');
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual(['success']);
    expect(outcomesOf(graph, 'node')).toEqual([]);
  });

  test('(pinned control) Success survives beside the four contract ports', () => {
    expect(signalPortsOf(SimpleJavascriptModule).sort()).toEqual([
      'completed',
      'done',
      'failure',
      'success',
      'unchanged'
    ]);
  });
});

// =================================================================================================
// Logic Builder
// =================================================================================================

/** A Blockly `workspaces.save()` payload, as `logic-builder-node.test.ts` builds one. */
function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>) {
  return { type, ...(fields ? { fields } : {}) };
}

describe('ERG-001 §4: Logic Builder', () => {
  async function logicGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [LogicBuilderModule as unknown as NodeModule],
      data: {
        components: [
          { name: '/root', nodes: [{ id: 'node', type: 'Logic Builder', parameters }], connections: [] }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  test('a Run reports Done then Completed, after the existing Success', async () => {
    const graph = await logicGraph({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'Outputs["a"] = 1;\n'
    });

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    const signals = graph.signalsFor('node').slice(from);
    expect(outcomesOf(graph, 'node', from)).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('success'));
  });

  /**
   * ⚠️ The second dead chain. A freshly dropped Logic Builder has no blocks, and `Run` on it
   * returned bare — the source said so in as many words. `Unchanged`, and nothing raised.
   */
  test('a Run with no blocks yet is Unchanged, and raises nothing', async () => {
    const graph = await logicGraph({});

    const from = graph.signalsFor('node').length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('blocks that throw are a Failure carrying the code', async () => {
    const graph = await logicGraph({
      workspace: workspace(block('noodl_set_output', { NAME: 'a' })),
      generatedCode: 'throw new Error("boom");'
    });

    const from = graph.signalsFor('node').length;
    const errorsBefore = graph.errors.length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['logic-builder/blocks-threw']);
  });

  /**
   * FINDINGS **SR-ix**, paid forward. The node registers block-declared output names verbatim,
   * so the contract's three names have to be reserved *before* they land here — otherwise a
   * program writing `Outputs.done` would silently flag the built-in signal instead.
   */
  test('a block program writing to a reserved contract name is refused, not swallowed', async () => {
    const graph = await logicGraph({
      workspace: workspace(block('noodl_set_output', { NAME: 'done' })),
      generatedCode: 'Outputs["done"] = 1;\n'
    });

    const from = graph.signalsFor('node').length;
    const errorsBefore = graph.errors.length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', from)).toEqual(['failure']);
    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['logic-builder/reserved-port-name']);
  });

  /**
   * ⚠️ The *second* door into `registerOutputIfNeeded`, and the one the value-side guard does
   * not cover. A `send signal` block reaches it through the execution context rather than
   * through `context.Outputs`, so without its own check a program sending `done` would pulse
   * the contract's completion signal — a graph told an action finished when all that happened
   * is that a block fired.
   */
  test('a block program sending a reserved contract signal is refused too', async () => {
    const graph = await logicGraph({
      workspace: workspace(block('noodl_send_signal', { NAME: 'completed' })),
      generatedCode: 'sendSignalOnOutput("completed");\n'
    });

    const from = graph.signalsFor('node').length;
    const errorsBefore = graph.errors.length;
    pulse(graph, 'node', 'run');
    await graph.settle(3);

    expect(graph.errors.slice(errorsBefore).map((e) => e.code)).toEqual(['logic-builder/reserved-port-name']);
    // The program's send did not become a `Completed` of its own: exactly one, from the outcome.
    expect(countOf(graph, 'node', 'completed', from)).toBe(1);
  });

  test('(pinned control) Success survives beside the four contract ports', () => {
    expect(signalPortsOf(LogicBuilderModule).sort()).toEqual([
      'completed',
      'done',
      'failure',
      'success',
      'unchanged'
    ]);
  });
});

/** Keeps `NodeInstance` referenced so the import is not dropped by `isolatedModules`. */
export type _Unused = NodeInstance;
