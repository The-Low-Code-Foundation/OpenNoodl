/**
 * VFN-011 — 🔴 **the drift gate.**
 *
 * The bench is a second execution context. That was ruled acceptable on 2026-08-13 with the cost
 * stated in the UI — the stubs are not the app's data — but the *other* half of the cost cannot be
 * stated away: an editor-side runner that slowly stops agreeing with the runtime is a **second
 * truth about what a program does**, and this register already has a name for that shape.
 *
 * So it is paid for once, here. Every fixture below is generated **once**, instrumented, and then
 * run twice:
 *
 *  - through `runOnBench` — the editor's path, `BenchRunner.ts`;
 *  - through the runtime's **own** `_executeLogic`, which is the real method, calling the real
 *    `_compileFunction` and the real `_createExecutionContext`, on a node instance stubbed down to
 *    the eight members it touches.
 *
 * ⚠️ **Why the real `_executeLogic` and not a hand-mirrored call.** Mirroring the runtime's call
 * site would make the gate blind to the one change most likely to happen: a parameter added, moved
 * or renamed in `_compileFunction` *and* in its caller together. Reaching for the method itself
 * means the runtime supplies both halves and the editor supplies neither, so the differential is
 * about the two compile paths and nothing else. `logic-builder.ts` is structured with
 * `_compileFunction` and `_probeFragment` as separate methods for exactly this kind of reach, and
 * the task says so.
 *
 * The two sides are handed the **same** `Noodl` stub — `createNoodlAPI` returns `window.Noodl` when
 * there is one, so installing the bench's sandbox on `global.window` makes the runtime wire its own
 * context out of it. That is deliberate: the gate is about the compile path, not about the stubs,
 * and a differential that also varied the data would fail for a reason it could not name.
 *
 * ## 🔴 The negative controls
 *
 * A suite of agreements is indistinguishable from an instrument that measured nothing. Three
 * deliberately divergent runners are built at the bottom — a rotated parameter list, a dropped
 * `__triggerSignal__`, and a probe that is not the identity — and the same differential is required
 * to catch each one. If those three pass, nothing above this line proved anything.
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { createBlockRunRecorder } from '@noodl/runtime/src/blockrun';
import { RESERVED_OUTPUTS } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';
import LogicBuilderNodeModule = require('@noodl/runtime/src/nodes/std-library/logic-builder');

import { LOGIC_BUILDER_PARAMETERS, buildSandboxNoodl, runOnBench } from '../../src/editor/src/views/BlocklyEditor/BenchRunner';
import type { SandboxNoodl } from '../../src/editor/src/views/BlocklyEditor/BenchRunner';
import { withBlockProbes } from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

initNoodlBlocks();
initNoodlGenerators();

/* eslint-disable @typescript-eslint/no-explicit-any */
const runtimeMethods = (LogicBuilderNodeModule as any).node.methods;

const NODE_ID = 'node-under-test';
const FIXED_TIME = 1_700_000_000_000;

/** What one run of one program came to, said the same way on both sides. */
interface Observation {
  outputs: Record<string, unknown>;
  /** Program-sent signals only; the node's own `success`/`failure` are not the program's. */
  signals: string[];
  refusedSignals: string[];
  refusedOutputs: string[];
  values: Record<string, { n: number; v: string[] }>;
  statements: Record<string, number>;
  error: string | undefined;
}

// ---------------------------------------------------------------------------
// The two paths
// ---------------------------------------------------------------------------

function observeOnBench(code: string, inputs: Record<string, unknown>, trigger: string, seed: Partial<SandboxNoodl>): Observation {
  const result = runOnBench({
    nodeId: NODE_ID,
    generatedCode: code,
    triggerSignal: trigger,
    inputs,
    seed,
    runId: 1,
    now: FIXED_TIME
  });

  // The frame is the viewer's shape plus one flag — criterion 7, and the reason a sandbox run is
  // distinguishable in the scrubber without a second history.
  expect(result.frame.nodeId).toBe(NODE_ID);
  expect(result.frame.sandbox).toBe(true);

  return {
    outputs: result.outputs,
    signals: result.signals,
    refusedSignals: result.refusedSignals,
    refusedOutputs: result.refusedOutputs,
    values: result.frame.values,
    statements: result.frame.statements,
    error: result.error
  };
}

/**
 * The runtime's own run.
 *
 * The stub is the eight members `_executeLogic` and `_createExecutionContext` actually touch, and
 * no more. Anything it does not need is deliberately absent, so a future runtime that reaches for
 * something new fails here loudly rather than being quietly accommodated.
 */
function observeInRuntime(
  code: string,
  workspaceJson: string,
  inputs: Record<string, unknown>,
  trigger: string,
  seed: Partial<SandboxNoodl>
): Observation {
  const sandbox = buildSandboxNoodl(seed);

  const recorder = createBlockRunRecorder();
  let taken: ReturnType<typeof recorder.take> | undefined;

  const internal: Record<string, unknown> = {
    workspace: workspaceJson,
    compiledFunction: null,
    compileError: null,
    executionError: null,
    inputValues: inputs,
    outputValues: {} as Record<string, unknown>,
    generatedCode: code
  };

  const signals: string[] = [];
  const raised: { code: string; message: string }[] = [];

  const node: Record<string, unknown> = {
    id: NODE_ID,
    _internal: internal,
    model: { parameters: { workspace: workspaceJson } },
    context: {
      beginBlockRun: () => recorder,
      endBlockRun: (_id: string, r: typeof recorder) => {
        taken = r.take(NODE_ID, 1, FIXED_TIME);
      }
    },
    hasOutput: () => false,
    registerOutput: () => undefined,
    flagOutputDirty: () => undefined,
    sendSignalOnOutput: (name: string) => signals.push(name),
    raiseRuntimeError: (errorCode: string, message: string) => raised.push({ code: errorCode, message })
  };

  for (const name of ['_io', '_fail', '_executeLogic', '_createExecutionContext', '_compileFunction', 'registerOutputIfNeeded']) {
    node[name] = runtimeMethods[name];
  }

  /**
   * ⚠️ `createNoodlAPI` returns `window.Noodl` when there is one and `{}` otherwise, so without
   * this the runtime side would see `Variables`, `Objects` and `Arrays` as `undefined` and every
   * fixture that touches them would fail for a reason that has nothing to do with drift.
   */
  const previousWindow = (global as any).window;
  (global as any).window = { Noodl: sandbox };
  try {
    (node._executeLogic as (t: string) => void).call(node, trigger);
  } finally {
    if (previousWindow === undefined) delete (global as any).window;
    else (global as any).window = previousWindow;
  }

  const frame = taken as NonNullable<typeof taken>;

  return {
    outputs: internal.outputValues as Record<string, unknown>,
    // `success` and `failure` are the node's, not the program's. Everything else came through
    // `context.sendSignalOnOutput`, which is the door a `send signal` block uses.
    signals: signals.filter((name) => RESERVED_OUTPUTS.indexOf(name) === -1),
    refusedSignals: raised
      .filter((r) => r.code === 'logic-builder/reserved-port-name' && r.message.includes('output signals'))
      .map((r) => r.message.split('"')[1]),
    refusedOutputs: raised
      .filter((r) => r.code === 'logic-builder/reserved-port-name' && r.message.includes('output ports'))
      .map((r) => r.message.split('"')[1]),
    values: frame.values,
    statements: frame.statements,
    error: (internal.executionError as string) || undefined
  };
}

// ---------------------------------------------------------------------------
// The fixture
// ---------------------------------------------------------------------------

interface Fixture {
  name: string;
  /** Built from real blocks, then generated instrumented, exactly as a flush would. */
  build?: (workspace: Blockly.Workspace) => void;
  /** Or hand-written, for the two facts no block can state. */
  code?: string;
  inputs?: Record<string, unknown>;
  trigger?: string;
  seed?: Partial<SandboxNoodl>;
  /** What a person doing this by hand would get. Asserted so a stable *wrong* answer cannot pass. */
  expect?: (observation: Observation) => void;
}

function number(workspace: Blockly.Workspace, n: number): Blockly.Block {
  const block = workspace.newBlock('math_number');
  block.setFieldValue(String(n), 'NUM');
  return block;
}

function text(workspace: Blockly.Workspace, value: string): Blockly.Block {
  const block = workspace.newBlock('text');
  block.setFieldValue(value, 'TEXT');
  return block;
}

function getInput(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_get_input');
  block.setFieldValue(name, 'NAME');
  return block;
}

function getVariable(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_get_variable');
  block.setFieldValue(name, 'NAME');
  return block;
}

function setVariable(workspace: Blockly.Workspace, name: string, value: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('noodl_set_variable');
  block.setFieldValue(name, 'NAME');
  block.getInput('VALUE')!.connection!.connect(value.outputConnection!);
  return block;
}

function setOutput(workspace: Blockly.Workspace, name: string, value: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('noodl_set_output');
  block.setFieldValue(name, 'NAME');
  block.getInput('VALUE')!.connection!.connect(value.outputConnection!);
  return block;
}

function arithmetic(workspace: Blockly.Workspace, op: string, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('math_arithmetic');
  block.setFieldValue(op, 'OP');
  block.getInput('A')!.connection!.connect(a.outputConnection!);
  block.getInput('B')!.connection!.connect(b.outputConnection!);
  return block;
}

function comparison(workspace: Blockly.Workspace, op: string, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('logic_compare');
  block.setFieldValue(op, 'OP');
  block.getInput('A')!.connection!.connect(a.outputConnection!);
  block.getInput('B')!.connection!.connect(b.outputConnection!);
  return block;
}

function sendSignal(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_send_signal');
  block.setFieldValue(name, 'NAME');
  return block;
}

const FIXTURES: Fixture[] = [
  {
    name: 'arithmetic — `a + b * c`, the shape precedence gets wrong',
    build(workspace) {
      const product = arithmetic(workspace, 'MULTIPLY', getInput(workspace, 'b'), getInput(workspace, 'c'));
      setOutput(workspace, 'result', arithmetic(workspace, 'ADD', getInput(workspace, 'a'), product));
    },
    inputs: { a: 1, b: 2, c: 3 },
    expect(o) {
      expect(o.outputs.result).toBe(7);
    }
  },
  {
    name: 'a loop — the iteration cap, the count, and a statement run more than once',
    build(workspace) {
      const repeat = workspace.newBlock('controls_repeat_ext');
      repeat.getInput('TIMES')!.connection!.connect(number(workspace, 5).outputConnection!);

      const bump = setVariable(
        workspace,
        'total',
        arithmetic(workspace, 'ADD', getVariable(workspace, 'total'), number(workspace, 2))
      );
      repeat.getInput('DO')!.connection!.connect(bump.previousConnection!);

      const tail = setOutput(workspace, 'total', getVariable(workspace, 'total'));
      repeat.nextConnection!.connect(tail.previousConnection!);
    },
    seed: { Variables: { total: 0 } },
    expect(o) {
      expect(o.outputs.total).toBe(10);
      // The loop body really did run five times — otherwise this fixture is an arithmetic one
      // wearing a loop's name, and it would agree for the wrong reason.
      expect(Object.values(o.statements).some((count) => count === 5)).toBe(true);
    }
  },
  {
    name: 'a conditional — the branch not taken must record nothing on either side',
    build(workspace) {
      const branch = workspace.newBlock('controls_if');
      branch.getInput('IF0')!.connection!.connect(
        comparison(workspace, 'GT', getInput(workspace, 'a'), number(workspace, 10)).outputConnection!
      );
      branch.getInput('DO0')!.connection!.connect(setOutput(workspace, 'result', text(workspace, 'big')).previousConnection!);
    },
    inputs: { a: 1 },
    expect(o) {
      expect(o.outputs.result).toBeUndefined();
      // The hollow tell is the whole of LGC-003 §2, and it is a *set difference* — so a fixture
      // where nothing is missing from the frame would not exercise it.
      expect(Object.keys(o.statements).length).toBeLessThan(2);
    }
  },
  {
    name: 'a variable read and write — the stub the bench admits to',
    build(workspace) {
      setVariable(workspace, 'greeting', text(workspace, 'hello'));
      setOutput(workspace, 'echo', getVariable(workspace, 'greeting'));
    },
    expect(o) {
      expect(o.outputs.echo).toBe('hello');
    }
  },
  {
    name: 'a signal — one that lands, and one the node owns and must refuse',
    build(workspace) {
      const ping = sendSignal(workspace, 'ping');
      // ⚠️ `done` is one of the node's own completion signals. A bench that let this through would
      // be teaching a program the app refuses, which is worse than one that cannot run at all.
      ping.nextConnection!.connect(sendSignal(workspace, 'done').previousConnection!);
    },
    expect(o) {
      expect(o.signals).toEqual(['ping']);
      expect(o.refusedSignals).toEqual(['done']);
    }
  },
  {
    name: 'a program that throws — reported, on both sides, rather than lost',
    build(workspace) {
      const nothing = workspace.newBlock('logic_null');
      const property = workspace.newBlock('noodl_get_object_property');
      property.setFieldValue('name', 'PROPERTY');
      property.getInput('OBJECT')!.connection!.connect(nothing.outputConnection!);
      setOutput(workspace, 'result', property);
    },
    expect(o) {
      expect(o.error).toBeDefined();
      expect(String(o.error)).toMatch(/null/i);
      expect(o.outputs.result).toBeUndefined();
    }
  },
  {
    /**
     * ⚠️ Hand-written, because no block reads the trigger. The eighth parameter was **built and
     * then not passed** for the whole of this node's life, so it read as `undefined` inside every
     * block program ever run. This is the gate that it arrives — on both paths, with the same
     * value — and it is the only way to state that fact at all.
     */
    name: '`__triggerSignal__` arrives, and is the signal that was pressed',
    code: '__s("s1");\nOutputs["firedBy"] = __p("v1", __triggerSignal__);\n',
    trigger: 'recalculate',
    expect(o) {
      expect(o.outputs.firedBy).toBe('recalculate');
      expect(o.values.v1).toEqual({ n: 1, v: ['"recalculate"'] });
    }
  },
  {
    /** The other hand-written one: a reserved *value* output, which is a different door. */
    name: 'a reserved output value is refused on both sides',
    code: '__s("s1");\nOutputs["error"] = __p("v1", "mine");\n__s("s2");\nOutputs["ok"] = __p("v2", 1);\n',
    expect(o) {
      expect(o.refusedOutputs).toEqual(['error']);
      // The outputs that *can* land still do — the order `_executeLogic` settled on.
      expect(o.outputs.ok).toBe(1);
    }
  }
];

/** Generate one fixture's program exactly as the editor's flush does. */
function programFor(fixture: Fixture): { code: string; workspaceJson: string } {
  if (fixture.code !== undefined) return { code: fixture.code, workspaceJson: '' };

  const workspace = new Blockly.Workspace();
  try {
    fixture.build!(workspace);
    const workspaceJson = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const generated = withBlockProbes(() => javascriptGenerator.workspaceToCode(workspace));
    return { code: generated.result, workspaceJson };
  } finally {
    workspace.dispose();
  }
}

describe('VFN-011 — the drift gate: the bench and the runtime agree about every fixture', () => {
  /**
   * ✅ **This row has now caught a real drift, which is the whole argument for it.**
   *
   * FIX-004's redaction ruling added an eleventh parameter, `console`, to the runtime's
   * `_compileFunction` and to nothing else. This assertion failed on the **arity** — because it
   * reads `compiled.length` off the runtime's own compile rather than off its source — and that is
   * what surfaced the bench and `evaluateFragment` as the two other places the list is spelled.
   * A version of this test that only compared its literal against `LOGIC_BUILDER_PARAMETERS` would
   * have stayed green while the bench ran block programs against a different contract.
   */
  it('compiles against the runtime\'s eleven parameters, in the runtime\'s order', () => {
    // Read off the runtime's own compile rather than off its source: this is the arity the
    // generated code is actually resolved against.
    const compiled = runtimeMethods._compileFunction.call({ _internal: { generatedCode: 'return 1;' } });
    expect(compiled.length).toBe(LOGIC_BUILDER_PARAMETERS.length);
    expect(LOGIC_BUILDER_PARAMETERS).toEqual([
      'Inputs',
      'Outputs',
      'Noodl',
      'Variables',
      'Objects',
      'Arrays',
      'sendSignalOnOutput',
      '__triggerSignal__',
      '__p',
      '__s',
      // 🔴 Last on purpose. Appending is what keeps every earlier position — and so every saved
      // `generatedCode` string — reading the argument it has always read.
      'console'
    ]);
  });

  for (const fixture of FIXTURES) {
    it(fixture.name, () => {
      const { code, workspaceJson } = programFor(fixture);
      const inputs = fixture.inputs || {};
      const trigger = fixture.trigger || 'run';
      const seed = fixture.seed || {};

      // The instrumentation is really in the string. Without this the whole file could be
      // comparing two runs of an uninstrumented program and agreeing for the wrong reason.
      expect(code).toMatch(/__[ps]\s*\(/);

      const bench = observeOnBench(code, { ...inputs }, trigger, seed);
      const runtime = observeInRuntime(code, workspaceJson, { ...inputs }, trigger, seed);

      expect(bench.outputs).toEqual(runtime.outputs);
      expect(bench.signals).toEqual(runtime.signals);
      expect(bench.refusedSignals).toEqual(runtime.refusedSignals);
      expect(bench.refusedOutputs).toEqual(runtime.refusedOutputs);
      // The frame, not merely the answer. The badges are made of this, so a runner that computed
      // the right outputs while recording a different program would still be a second truth.
      expect(bench.values).toEqual(runtime.values);
      expect(bench.statements).toEqual(runtime.statements);
      expect(Boolean(bench.error)).toBe(Boolean(runtime.error));

      // And the answer is the one a person would get, not merely a stable wrong one shared by two
      // paths that are wrong together.
      if (fixture.expect) {
        fixture.expect(bench);
        fixture.expect(runtime);
      }
    });
  }
});

describe('VFN-011 — 🔴 NEGATIVE CONTROLS: the differential catches a runner that drifted', () => {
  /**
   * A bench runner built the wrong way, run over the same fixture the gate uses.
   *
   * These are not hypothetical shapes. Every one of them has happened to this node or to something
   * beside it: `__triggerSignal__` was built and not passed; the probe pair was added as the ninth
   * and tenth parameters after the other eight existed; `console` was added as the eleventh and
   * landed on the runtime side only, which this file caught; and the whole reason `__p` is documented as
   * an identity function is that a probe which is not one changes what the program computes.
   */
  function driftedObservation(
    code: string,
    parameters: readonly string[],
    argumentsFor: (context: {
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
      sandbox: SandboxNoodl;
      send: (name: string) => void;
      trigger: string;
      probeValue: (id: string, value: unknown) => unknown;
      probeStatement: (id: string) => void;
      /** Eleventh (FIX-004 redaction b). A drift row supplies it so its ONLY drift is the intended one. */
      blockConsole: Console;
    }) => unknown[]
  ): { outputs: Record<string, unknown>; values: Record<string, { n: number; v: string[] }>; threw: boolean } {
    const outputs: Record<string, unknown> = {};
    const sandbox = buildSandboxNoodl({});
    const recorder = createBlockRunRecorder();
    const signals: string[] = [];

    let threw = false;
    try {
      const fn = new Function(...parameters, code) as (...args: unknown[]) => unknown;
      fn(
        ...argumentsFor({
          inputs: { a: 1, b: 2, c: 3 },
          outputs,
          sandbox,
          send: (name) => signals.push(name),
          trigger: 'recalculate',
          probeValue: recorder.probeValue,
          probeStatement: recorder.probeStatement,
          blockConsole: console
        })
      );
    } catch {
      threw = true;
    }

    const frame = recorder.take(NODE_ID, 1, FIXED_TIME);
    return { outputs, values: frame.values, threw };
  }

  const ARITHMETIC = FIXTURES[0];
  const TRIGGER = FIXTURES[6];

  it('catches a rotated parameter list — the same eleven names in the wrong order', () => {
    const { code } = programFor(ARITHMETIC);
    const rotated = [...LOGIC_BUILDER_PARAMETERS.slice(1), LOGIC_BUILDER_PARAMETERS[0]];

    const drifted = driftedObservation(code, rotated, (c) => [
      c.inputs,
      c.outputs,
      c.sandbox,
      c.sandbox.Variables,
      c.sandbox.Objects,
      c.sandbox.Arrays,
      c.send,
      c.trigger,
      c.probeValue,
      c.probeStatement,
      c.blockConsole
    ]);

    // `Outputs` is now bound to whatever the first argument was, so the program's write lands
    // nowhere the node will ever read it. Silently — nothing throws.
    const honest = observeOnBench(code, { a: 1, b: 2, c: 3 }, 'run', {});
    expect(honest.outputs.result).toBe(7);
    expect(drifted.outputs).not.toEqual(honest.outputs);
  });

  it('catches a dropped `__triggerSignal__` — the failure this node actually had', () => {
    const { code } = programFor(TRIGGER);
    const withoutTrigger = LOGIC_BUILDER_PARAMETERS.filter((name) => name !== '__triggerSignal__');

    const drifted = driftedObservation(code, withoutTrigger, (c) => [
      c.inputs,
      c.outputs,
      c.sandbox,
      c.sandbox.Variables,
      c.sandbox.Objects,
      c.sandbox.Arrays,
      c.send,
      c.probeValue,
      c.probeStatement,
      c.blockConsole
    ]);

    // Not a crash — a `ReferenceError` on a name the program was promised. Either way the
    // differential is red, which is the point: this is what "built and then not passed" looked
    // like, and it went unnoticed for the life of the node.
    const honest = observeOnBench(code, {}, 'recalculate', {});
    expect(honest.outputs.firedBy).toBe('recalculate');
    expect(drifted.threw || drifted.outputs.firedBy !== 'recalculate').toBe(true);
  });

  it('catches a probe that is not the identity function', () => {
    const { code } = programFor(ARITHMETIC);

    const drifted = driftedObservation(code, LOGIC_BUILDER_PARAMETERS, (c) => [
      c.inputs,
      c.outputs,
      c.sandbox,
      c.sandbox.Variables,
      c.sandbox.Objects,
      c.sandbox.Arrays,
      c.send,
      c.trigger,
      // The whole safety argument for instrumenting the one string the runtime executes is that
      // `__p` hands back what it was given. A probe that records and returns `undefined` is the
      // shape that breaks it, and it breaks it silently for any program whose answer is falsy.
      (_id: string, _value: unknown) => undefined,
      c.probeStatement,
      c.blockConsole
    ]);

    const honest = observeOnBench(code, { a: 1, b: 2, c: 3 }, 'run', {});
    expect(honest.outputs.result).toBe(7);
    expect(drifted.outputs.result).not.toBe(7);
  });

  it('the differential is comparing two live paths, not one path with itself', () => {
    // The cheapest way this file could be vacuous: `observeInRuntime` silently falling back to the
    // bench, or the runtime method not being the runtime's. Both are asserted rather than assumed.
    expect(typeof runtimeMethods._executeLogic).toBe('function');
    expect(typeof runtimeMethods._compileFunction).toBe('function');
    expect(typeof runtimeMethods._createExecutionContext).toBe('function');

    // And the runtime path really did execute: a fixture whose answer only exists if it did.
    const { code, workspaceJson } = programFor(ARITHMETIC);
    const runtime = observeInRuntime(code, workspaceJson, { a: 1, b: 2, c: 3 }, 'run', {});
    expect(runtime.outputs.result).toBe(7);
    expect(Object.keys(runtime.values).length).toBeGreaterThan(3);
  });
});
