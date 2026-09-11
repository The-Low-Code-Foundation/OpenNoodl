/**
 * FUN-007 — the loop closes after the run.
 *
 * The phase's originating user added two ports in the property panel, opened the Script and
 * wrote their input into their output *by name*. Three things had to be true for that to be
 * as silent as it was, and this file pins all three from the run side:
 *
 * §1 a Function that finishes and writes none of the outputs it has says so;
 * §2 a throw is anchored to the line **of the author's document**, not of the compiled
 *    source, and does not outlive the text that caused it;
 * §3 a `ReferenceError` on a name that is a port on this node is told what it is.
 *
 * ⚠️ **One premise in the spec is false, and this file records it.** FUN-007's register
 * (F24) and the phase README both state that `var Output_1 = Input_1` *"runs successfully"*.
 * It does not — reading an undeclared identifier throws `ReferenceError` in sloppy mode as
 * well as strict, so that exact body has always thrown, always fired `Failure`, and always
 * put its message on `Error`. The genuinely silent shape is the *other* half of the same
 * mistake: `Output_1 = Inputs.Input_1`, where the read is correct and the write lands on an
 * implicit global. Both are covered below, under the names of what they actually do.
 */

/* eslint-env jest */

import type { NodeModule } from '@noodl/types';

import {
  noOutputWrittenMessage,
  portReference,
  portUsage,
  rawPositionFromStack,
  stackLineOffset,
  undeclaredPortNameMessage,
  userPositionForError
} from '../../src/nodes/std-library/functionDiagnostics';
import { createCorpusGraph, type CorpusGraph } from '../corpus/graph-harness';

import ExpressionNode = require('../../src/nodes/std-library/expression');
import SimpleJavascriptNode = require('../../src/nodes/std-library/simplejavascript');

const NO_OUTPUT_KEY = 'js-function-no-output-written';
const RUN_ERROR_KEY = 'js-function-run-waring';

interface FunctionGraphOptions {
  script: string;
  /** Output ports as the author declared them in the `scriptOutputs` proplist. */
  declaredOutputs?: string[];
  /** Input ports as the author declared them in the `scriptInputs` proplist. */
  declaredInputs?: string[];
  /** `outtype-<label>` parameters, for the signal case. */
  outputTypes?: Record<string, string>;
  /** Ports pushed straight onto the node model — the route the editor's dynamic ports take. */
  modelPorts?: Array<{ name: string; plug: string; type: string }>;
}

function proplist(labels: string[]) {
  return labels.map((label, index) => ({ id: 'row-' + index, label }));
}

async function functionGraph(options: FunctionGraphOptions): Promise<CorpusGraph> {
  const parameters: Record<string, unknown> = { functionScript: options.script };
  if (options.declaredOutputs) parameters.scriptOutputs = proplist(options.declaredOutputs);
  if (options.declaredInputs) parameters.scriptInputs = proplist(options.declaredInputs);
  for (const label in options.outputTypes || {}) {
    parameters['outtype-' + label] = options.outputTypes[label];
  }

  const graph = await createCorpusGraph({
    modules: [SimpleJavascriptNode as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'fn', type: 'JavaScriptFunction', parameters, ports: options.modelPorts || [] }],
          connections: []
        }
      ]
    } as never
  });

  await graph.settle(2);
  return graph;
}

/**
 * One `Run` pulse. The port is edge-triggered — only false → true is an event — so a second
 * pulse has to fall first, which is what the viewer's signal wire does for real.
 */
function run(graph: CorpusGraph): void {
  const fn = graph.node('fn');
  fn.setInputValue('run', false);
  fn.setInputValue('run', true);
}

/**
 * ⚠️ **An implicit global written by one Function body is visible to every other one.**
 *
 * Found by this file failing: `Output_1 = Inputs.Input_1` in the §1 case creates
 * `globalThis.Output_1`, and a *later* body reading a bare `Output_1` then found it and did
 * not throw. That is not a test artefact — Function bodies are compiled non-strict and share
 * one global object, so in a real project the first node to make this mistake quietly
 * disarms the `ReferenceError` for every node that makes it afterwards. Filed in FUN-007's
 * register as F30; here it is only swept up so the rows below do not depend on their order.
 */
const LEAKED_GLOBALS = ['Output_1', 'Out_Bare', 'Input_1'];

beforeEach(() => {
  for (const name of LEAKED_GLOBALS) delete (globalThis as Record<string, unknown>)[name];
});

function warningsWithKey(graph: CorpusGraph, key: string) {
  return graph.editorConnection.warnings.filter((w) => w.key === key);
}

function messageWithKey(graph: CorpusGraph, key: string): string {
  const found = warningsWithKey(graph, key);
  return found.length > 0 ? String(found[found.length - 1].message) : '';
}

/* ------------------------------------------------------------------ *
 * §1 — "this node wrote no output"
 * ------------------------------------------------------------------ */

describe('FUN-007 §1 — a run that produces nothing says so', () => {
  /**
   * The originating mistake, in the shape that is actually silent. `Output_1` on the left of
   * `=` in a sloppy-mode body creates a global; nothing reaches the port, nothing throws,
   * `Success` fires, and before this task the node had nothing at all to say about it.
   */
  test('an output declared in the panel and never written raises the advisory', async () => {
    const graph = await functionGraph({
      script: 'Output_1 = Inputs.Input_1;',
      declaredOutputs: ['Output_1'],
      declaredInputs: ['Input_1']
    });

    run(graph);
    await graph.settle(4);

    // The consequence first: the run succeeded. That is the whole problem.
    expect(graph.signalsFor('fn')).toContain('success');

    const message = messageWithKey(graph, NO_OUTPUT_KEY);
    expect(message).toContain('"Output_1"');
    expect(message).toContain('Outputs.Output_1 = ...');
    // Phase 61's standing constraint: the legacy alias is supported forever and never written.
    expect(message).not.toContain('Noodl.Inputs');
    expect(message).not.toContain('Noodl.Outputs');
  });

  test('the same node writing the output correctly says nothing', async () => {
    const graph = await functionGraph({
      script: 'Outputs.Output_1 = Inputs.Input_1;',
      declaredOutputs: ['Output_1'],
      declaredInputs: ['Input_1']
    });

    run(graph);
    await graph.settle(4);

    expect(warningsWithKey(graph, NO_OUTPUT_KEY)).toHaveLength(0);
  });

  /**
   * The narrowing that keeps this from being noise. A Function used purely for a side effect
   * is legitimate and common, and it has no output ports for the same reason it has nothing
   * to say.
   */
  test('a Function with no output ports at all never warns', async () => {
    const graph = await functionGraph({ script: 'const unused = Inputs.Input_1;', declaredInputs: ['Input_1'] });

    run(graph);
    await graph.settle(4);

    expect(warningsWithKey(graph, NO_OUTPUT_KEY)).toHaveLength(0);
  });

  /**
   * ⚠️ The ordering inside the proxy trap, as a test. `outputValuesProxy` returns early when
   * the assigned value equals the one already there — so counting the write *after* that
   * check would report "wrote no output" on the second run of a node whose code plainly
   * writes one.
   */
  test('re-writing the same value still counts as writing an output', async () => {
    const graph = await functionGraph({ script: 'Outputs.Output_1 = 1;', declaredOutputs: ['Output_1'] });

    run(graph);
    await graph.settle(4);
    run(graph);
    await graph.settle(4);

    expect(warningsWithKey(graph, NO_OUTPUT_KEY)).toHaveLength(0);
  });

  /**
   * A signal output is a *call*, so it never reaches the proxy's `set` trap. Counting only
   * assignments would accuse a node that had just fired.
   */
  test('a signal output that fired is not "no output"', async () => {
    const graph = await functionGraph({
      script: 'Outputs.Done();',
      modelPorts: [{ name: 'out-Done', plug: 'output', type: 'signal' }]
    });

    run(graph);
    await graph.settle(4);

    expect(warningsWithKey(graph, NO_OUTPUT_KEY)).toHaveLength(0);
  });

  test('a signal output that never fired is offered a call, not an assignment', async () => {
    const graph = await functionGraph({
      script: 'const nothing = 1;',
      declaredOutputs: ['Done'],
      outputTypes: { Done: 'signal' }
    });

    run(graph);
    await graph.settle(4);

    const message = messageWithKey(graph, NO_OUTPUT_KEY);
    expect(message).toContain('Outputs.Done()');
    expect(message).not.toContain('Outputs.Done =');
  });

  /**
   * §4 — a warning, never an error, and not in the project-wide count. A side-effect-only
   * node will trip this through some branch on some run, and a red node for a legitimate
   * program teaches people to ignore the dot.
   */
  test('the advisory is a warning, and stays out of the project-wide count', async () => {
    const graph = await functionGraph({ script: 'Output_1 = 1;', declaredOutputs: ['Output_1'] });

    // The harness flattens payloads to `{key, message}`, so the whole payload is captured here.
    const payloads: Array<Record<string, unknown>> = [];
    const original = graph.editorConnection.sendWarning;
    graph.editorConnection.sendWarning = function (component, nodeId, key, warning) {
      if (key === NO_OUTPUT_KEY) payloads.push(warning as Record<string, unknown>);
      return original.call(this, component, nodeId, key, warning);
    };

    run(graph);
    await graph.settle(4);

    expect(payloads).toHaveLength(1);
    expect(payloads[0].level).toBe('warning');
    // `showGlobally` is the title-bar count. An advisory that a legitimate node can trip on
    // some run does not belong in a number people are meant to drive to zero.
    expect(payloads[0].showGlobally).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * §2 — the error is anchored where the author is looking
 * ------------------------------------------------------------------ */

describe("FUN-007 §2 — the throw is mapped back to the author's document", () => {
  /**
   * ⚠️ The prefix-offset check, stated the way the spec insists it be stated: **first line**.
   * The body is compiled as `new AsyncFunction(...)` with `getCodePrefix()` in front of it, so
   * the engine's line number is not the author's. An error anchored one line off accuses
   * innocent code, which is worse than anchoring nothing at all.
   */
  test('a body whose first line throws is reported at line 1', async () => {
    const graph = await functionGraph({ script: 'throw new Error("first line");' });

    run(graph);
    await graph.settle(4);

    expect(messageWithKey(graph, RUN_ERROR_KEY)).toContain('Line 1:');
  });

  test('a body whose third line throws is reported at line 3', async () => {
    const graph = await functionGraph({
      script: 'const a = 1;\nconst b = 2;\nthrow new Error("third line");'
    });

    run(graph);
    await graph.settle(4);

    expect(messageWithKey(graph, RUN_ERROR_KEY)).toContain('Line 3:');
  });

  test('the offset is measured, not assumed, and is at least the prefix', () => {
    // One line of code prefix plus whatever header the engine synthesises. Asserting the
    // *value* would pin an engine detail; asserting it is positive and finite is the honest
    // claim, and the two line tests above are what actually prove it right.
    const offset = stackLineOffset();
    expect(offset).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(offset)).toBe(true);
  });

  test('a stack with no position at all yields no position, rather than line zero', () => {
    expect(rawPositionFromStack(undefined)).toBeUndefined();
    expect(rawPositionFromStack('Error: nothing here')).toBeUndefined();
    // The message line is never read as a frame, even when it looks like one.
    expect(rawPositionFromStack('Error: <anonymous>:9:9')).toBeUndefined();
    expect(userPositionForError({ stack: 'Error: boom\n    at somewhere (file.js:1:1)' })).toBeUndefined();
  });

  /**
   * The previously-filed trap: an error outliving the code that caused it. The author has
   * already deleted the bad line, and a stale message that names a real line number is
   * exactly the one they will believe.
   */
  test("editing the script clears the previous run's error", async () => {
    const graph = await functionGraph({ script: 'throw new Error("stale");' });

    run(graph);
    await graph.settle(4);
    expect(warningsWithKey(graph, RUN_ERROR_KEY).length).toBeGreaterThan(0);
    expect(graph.node('fn').getOutput('error').value).toBe('stale');

    graph.node('fn').setInputValue('functionScript', 'const fine = 1;');
    await graph.settle(4);

    expect(warningsWithKey(graph, RUN_ERROR_KEY)).toHaveLength(0);
    expect(graph.node('fn').getOutput('error').value).toBeUndefined();
  });

  /**
   * The other half of "the next run reports only what that run did". `this` inside a Function
   * body is a receiver that persists across runs, so one script can throw on its first run
   * and not on its second without the text ever changing.
   *
   * ⚠️ The first run here is the one the `functionScript` setter schedules at load — a node
   * whose `Run` port is unconnected runs the moment it is given a script (NDA-017 §2). That
   * is why the first assertion needs no pulse.
   */
  test("a run that succeeds clears the previous run's error", async () => {
    const graph = await functionGraph({
      script: 'if (!this.hasRun) { this.hasRun = true; throw new Error("only the first time"); }'
    });

    expect(warningsWithKey(graph, RUN_ERROR_KEY).length).toBeGreaterThan(0);

    run(graph);
    await graph.settle(4);
    expect(warningsWithKey(graph, RUN_ERROR_KEY)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * §3 — a ReferenceError on a name that is a port
 * ------------------------------------------------------------------ */

describe('FUN-007 §3 — the name that is a port', () => {
  /**
   * The originating body, and the correction to F24: it throws. What was missing was not the
   * report but the *reading* of it — "Input_1 is not defined" is true and useless, because
   * `Input_1` is a port the author declared minutes earlier.
   */
  test('the originating body throws, and the throw is now explained', async () => {
    const graph = await functionGraph({
      script: 'var Output_1 = Input_1;',
      declaredInputs: ['Input_1'],
      declaredOutputs: ['Output_1']
    });

    run(graph);
    await graph.settle(4);

    const message = messageWithKey(graph, RUN_ERROR_KEY);
    expect(message).toContain('Line 1:');
    expect(message).toContain('Input_1 is not defined');
    expect(message).toContain('Input_1 is an input port on this node. Read it with Inputs.Input_1.');
    expect(message).not.toContain('Noodl.Inputs');
  });

  test('a bare output name is told it is an output, and how to write it', async () => {
    const graph = await functionGraph({
      script: 'Outputs.other = Out_Bare;',
      declaredOutputs: ['Out_Bare']
    });

    run(graph);
    await graph.settle(4);

    expect(messageWithKey(graph, RUN_ERROR_KEY)).toContain(
      'Out_Bare is an output port on this node. Write it with Outputs.Out_Bare = ...'
    );
  });

  /**
   * The guard on the whole idea: a hint about a name we cannot vouch for is worse than the
   * engine's own words, so a `ReferenceError` on anything that is not a port on *this* node
   * gets no hint at all.
   */
  test('a ReferenceError on a name that is not a port is left alone', async () => {
    const graph = await functionGraph({ script: 'const x = someLibraryNobodyLoaded;' });

    run(graph);
    await graph.settle(4);

    const message = messageWithKey(graph, RUN_ERROR_KEY);
    expect(message).toContain('someLibraryNobodyLoaded is not defined');
    expect(message).not.toContain('is an input port');
    expect(message).not.toContain('is an output port');
  });

  test('a throw is not also reported as silence', async () => {
    const graph = await functionGraph({
      script: 'var Output_1 = Input_1;',
      declaredInputs: ['Input_1'],
      declaredOutputs: ['Output_1']
    });

    run(graph);
    await graph.settle(4);

    // The node has an unwritten output port and it did not write it — but it threw, and one
    // node saying two things about one mistake is the failure §3 opens by naming.
    expect(warningsWithKey(graph, NO_OUTPUT_KEY)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * The notation, built in one place
 * ------------------------------------------------------------------ */

describe('FUN-007 — the notation the messages are built from', () => {
  test('a label that cannot follow a dot is bracketed', () => {
    expect(portReference('Inputs', 'Input_1')).toBe('Inputs.Input_1');
    expect(portReference('Outputs', 'My Value')).toBe('Outputs["My Value"]');
    expect(portReference('Inputs', '2nd')).toBe('Inputs["2nd"]');
  });

  test('a value output is an assignment and a signal output is a call', () => {
    expect(portUsage('Outputs', 'Result', false)).toBe('Outputs.Result = ...');
    expect(portUsage('Outputs', 'Done', true)).toBe('Outputs.Done()');
    expect(portUsage('Outputs', 'All Done', true)).toBe('Outputs["All Done"]()');
  });

  test('no message anywhere emits the legacy alias', () => {
    const messages = [
      undeclaredPortNameMessage('Input_1', 'Inputs'),
      undeclaredPortNameMessage('Output_1', 'Outputs'),
      undeclaredPortNameMessage('Done', 'Outputs', true),
      noOutputWrittenMessage([{ label: 'Output_1', isSignal: false }]),
      noOutputWrittenMessage([
        { label: 'a', isSignal: false },
        { label: 'b', isSignal: false }
      ]),
      noOutputWrittenMessage([{ label: 'Done', isSignal: true }])
    ];

    for (const message of messages) {
      expect(message).not.toContain('Noodl.Inputs');
      expect(message).not.toContain('Noodl.Outputs');
      // The tooltip joins messages as HTML; an unescaped angle bracket would eat the rest.
      expect(message).not.toContain('<');
    }
  });

  test('every unwritten port is named, not just the first', () => {
    const message = noOutputWrittenMessage([
      { label: 'a', isSignal: false },
      { label: 'b', isSignal: false }
    ]);
    expect(message).toContain('"a"');
    expect(message).toContain('"b"');
  });
});

/* ------------------------------------------------------------------ *
 * The mode boundary
 * ------------------------------------------------------------------ */

/**
 * ⚠️ Phase 61's hardest standing constraint: nothing may leak into `'expression'` mode, where
 * a bare identifier *becomes* a port. Suggesting `Inputs.foo` there would mint a port called
 * `Inputs`. FUN-007 is entirely inside the Function node, and this is the test that keeps it
 * that way — same text, other node, nothing said.
 */
describe('FUN-007 — nothing leaks into Expression mode', () => {
  test('the same text on an Expression node raises neither FUN-007 warning', async () => {
    const graph = await createCorpusGraph({
      modules: [ExpressionNode as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'expr', type: 'Expression', parameters: { expression: 'Output_1 = Input_1' } }],
            connections: []
          }
        ]
      } as never
    });

    await graph.settle(4);

    const keys = graph.editorConnection.warnings.map((w) => w.key);
    expect(keys).not.toContain(NO_OUTPUT_KEY);
    expect(keys).not.toContain(RUN_ERROR_KEY);
  });
});
