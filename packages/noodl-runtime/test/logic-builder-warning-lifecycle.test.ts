/**
 * Logic Builder: the warning a failure draws must come down when the failure stops being true.
 *
 * ## The defect, in the words it was reported in
 *
 * Richard, 2026-09-04: *"when that error got thrown on the visual function node and it went dotted
 * line style, I fixed the problem, ran the function again and the error persisted. I refreshed the
 * preview window, the error cleared, ran the function and no error."*
 *
 * ## Why it happened, and why no existing test saw it
 *
 * `raiseRuntimeError` puts the failure on the runtime error bus; `createEditorWarningSubscriber`
 * forwards it to `sendWarning`, keyed on the failure code. **The bus has a raise and no withdraw.**
 * Nothing on that channel ever called `clearWarning`, so the dotted style survived every later good
 * run. The only thing that cleared it was a preview refresh — `ViewerConnection` wipes every
 * viewer-originated warning on reconnect, which is a bigger hammer, not a fix.
 *
 * `runtimeerror.test.ts` pins the forward and stops there: it asserts the raise reaches
 * `sendWarning`, which was true before and after the defect. The missing half is a *sequence*, so
 * it needs a test that runs the node twice — which is what this file is.
 *
 * ## The shape of every case here
 *
 * One node, run more than once, asserting what the editor was told **between** the runs. A test
 * that ran the node once could not tell a warning that is correctly present from one that is stuck.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');

/** The failure Richard actually hit: the default signal name was `done`, which the node owns. */
const RESERVED_CODE = 'logic-builder/reserved-port-name';

/** Build a Blockly `workspaces.save()` payload from top-level blocks. */
function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>) {
  return { type, ...(fields ? { fields } : {}) };
}

interface Harness {
  node: any;
  sendWarning: jest.Mock;
  clearWarning: jest.Mock;
  run(): void;
  setCode(code: string): void;
}

function createHarness(generatedCode: string): Harness {
  const sendWarning = jest.fn();
  const clearWarning = jest.fn();

  const context = new NodeContext({
    // `runningInEditor` matters: with it false, `NodeContext` also subscribes the console
    // subscriber, and this suite would print a stack per intentional failure.
    runningInEditor: true,
    editorConnection: {
      sendWarning,
      clearWarning,
      on() {},
      isConnected: () => false
    }
  });
  context.nodeRegister.register(NodeDefinition.defineNode(LogicBuilderModule.node));

  const node = context.nodeRegister.createNode('Logic Builder', 'lb-1');
  node.setInputValue('workspace', workspace(block('noodl_send_signal', { NAME: 'finished' })));
  node.setInputValue('generatedCode', generatedCode);

  return {
    node,
    sendWarning,
    clearWarning,
    // `run` is `valueChangedToTrue`, so a second run needs the value to fall first.
    run() {
      node.setInputValue('run', false);
      node.setInputValue('run', true);
    },
    // The setter resets `compiledFunction`, which is what makes "the author fixed it" expressible.
    setCode(code: string) {
      node.setInputValue('generatedCode', code);
    }
  };
}

/** Was this key sent/cleared at least once? Named so the assertions read as sentences. */
function calledWithKey(mock: jest.Mock, key: string): boolean {
  return mock.mock.calls.some((call) => call[2] === key);
}

describe('Logic Builder — a failure warning comes down on the next good run', () => {
  it('raises the warning on the failing run', () => {
    const h = createHarness('sendSignalOnOutput("done");\n');

    h.run();

    // The known-firing signal. Every absence asserted below is only meaningful because this
    // fires first — a test that opened with a silent channel would prove nothing at all.
    expect(calledWithKey(h.sendWarning, RESERVED_CODE)).toBe(true);
  });

  it('⚠️ SEPARATE PRE-EXISTING DEFECT — a refused signal send still reports success', () => {
    /**
     * 🔴 **Found by this suite, not fixed by it, and recorded here so it is not rediscovered.**
     *
     * The reserved-*output* check returns out of `_executeLogic` (`logic-builder.ts`, the
     * `reservedName` branch). The reserved-*signal* check does not: it lives inside the
     * `sendSignalOnOutput` wrapper, so it fails, returns from the wrapper, and execution carries
     * straight on to the success path — which sets `executionError = null` and pulses `Success`.
     *
     * So a Visual Function that sends a reserved signal name raises a runtime error, pulses
     * `Failure`, AND THEN pulses `Success` with an empty `Error` port. The dotted node is the only
     * honest surface; a graph sequenced on `Error` or `Success` is told the run was fine.
     *
     * ⚠️ Asserted as it actually behaves, deliberately. Changing it means changing what `Success`
     * means on this node, which is ERG-001 territory and a decision rather than a tidy-up — so
     * this test documents the behaviour and will fail loudly the day someone fixes it, which is
     * when this comment should be read.
     */
    const h = createHarness('sendSignalOnOutput("done");\n');

    h.run();

    expect(calledWithKey(h.sendWarning, RESERVED_CODE)).toBe(true);
    expect(h.node.getOutput('error').value).toBe('');
  });

  it('does NOT clear it while the program is still broken', () => {
    const h = createHarness('sendSignalOnOutput("done");\n');

    h.run();
    h.run();

    // The control for the case below: a clear that happened on every run, good or bad, would make
    // the next test green while the node lied in the opposite direction.
    expect(calledWithKey(h.clearWarning, RESERVED_CODE)).toBe(false);
  });

  it('🔴 clears it once the author fixes the program and runs again', () => {
    const h = createHarness('sendSignalOnOutput("done");\n');

    h.run();
    expect(calledWithKey(h.sendWarning, RESERVED_CODE)).toBe(true);
    expect(calledWithKey(h.clearWarning, RESERVED_CODE)).toBe(false);

    // Richard's "I fixed the problem, ran the function again".
    h.setCode('sendSignalOnOutput("finished");\n');
    h.run();

    expect(calledWithKey(h.clearWarning, RESERVED_CODE)).toBe(true);
    expect(h.node.getOutput('error').value).toBe('');
  });

  it('clears it against the same node id the warning was raised against', () => {
    const h = createHarness('sendSignalOnOutput("done");\n');
    h.run();
    h.setCode('sendSignalOnOutput("finished");\n');
    h.run();

    const raised = h.sendWarning.mock.calls.find((call) => call[2] === RESERVED_CODE);
    const cleared = h.clearWarning.mock.calls.find((call) => call[2] === RESERVED_CODE);

    // A clear keyed differently from the set is the failure mode that looks exactly like a fix —
    // the call happens, the warning stays. Component name and node id must both match.
    expect(cleared).toBeDefined();
    expect(cleared![0]).toBe(raised![0]);
    expect(cleared![1]).toBe(raised![1]);
    expect(cleared![1]).toBe('lb-1');
  });

  it('🔴 re-raises the SAME failure after a good run, rather than going quiet', () => {
    // The second half of the defect. `_fail` deduplicates the raise on `lastReportedError`, so
    // clearing the warning without resetting that key would leave the node silent exactly when it
    // had something to say again — a stuck warning traded for a missing one.
    const h = createHarness('sendSignalOnOutput("done");\n');

    h.run();
    const raisesAfterFirstFailure = h.sendWarning.mock.calls.filter((c) => c[2] === RESERVED_CODE).length;

    h.setCode('sendSignalOnOutput("finished");\n');
    h.run();

    h.setCode('sendSignalOnOutput("done");\n');
    h.run();

    const raisesAfterSecondFailure = h.sendWarning.mock.calls.filter((c) => c[2] === RESERVED_CODE).length;

    expect(raisesAfterFirstFailure).toBe(1);
    expect(raisesAfterSecondFailure).toBe(2);
  });

  it('leaves a node that never failed alone', () => {
    // Cardinality on the quiet path: a good run must not spray `clearWarning` at keys it never
    // raised. `all([])` is the answer you wanted, so the count is asserted rather than a predicate.
    const h = createHarness('sendSignalOnOutput("finished");\n');

    h.run();

    expect(h.sendWarning).not.toHaveBeenCalled();
    expect(h.clearWarning).not.toHaveBeenCalled();
    expect(h.node.getOutput('error').value).toBe('');
  });
});
