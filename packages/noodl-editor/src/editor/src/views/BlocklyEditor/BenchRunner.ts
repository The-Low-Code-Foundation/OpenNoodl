/**
 * VFN-011 — the bench's engine: run a block program in the editor, against sandbox values.
 *
 * > *"it would make sense if you could set sandbox values for any variables or inputs, then
 * > manually trigger the run signal … to see the sandbox values evaluated into outputs right there
 * > in the editor without having to click stuff on the node canvas."*
 *
 * With the app stopped. That is the whole of it, and it is why this file exists at all: LGC-002's
 * Do It and LGC-003's badges both answer from the **viewer**, so both are silent for a builder who
 * has not started a preview — which is most of them, most of the time, and certainly the moment
 * they are writing the program.
 *
 * ## 🔴 What this is, said honestly
 *
 * **A second execution context.** Ruled acceptable on 2026-08-13, with the cost stated rather than
 * hidden: `Noodl.Variables`, `Noodl.Objects` and `Noodl.Arrays` are in-memory stubs seeded from the
 * bench, not the live app's data, and the UI says so wherever it shows a value. What is *not*
 * acceptable is the second half of that risk — a runner that quietly stops agreeing with the
 * runtime about what a program does. That is paid for once, by a gate rather than by a promise:
 * `tests-unit/vfn-011/drift-gate.spec.ts` runs the same `generatedCode` through this compile path
 * and through the runtime's own `_compileFunction`, over a fixture of programs, and requires them
 * to agree on outputs, on signals and on the recorded frame.
 *
 * ## The four things it does not get to improvise
 *
 * 1. **The parameter list.** {@link LOGIC_BUILDER_PARAMETERS} is ten names in one order, and the
 *    gate proves it is the runtime's ten in the runtime's order. A tenth parameter added on one
 *    side only is precisely the drift this file is built to be caught doing.
 * 2. **The probes.** The recorder is the runtime's own {@link createBlockRunRecorder}, not a copy,
 *    so a bench frame is the same object a viewer frame is — same value dialect, same iteration
 *    cap, same truncation flag — and it therefore feeds `BlockRunHistory` and the badges through
 *    the existing path rather than a parallel one.
 * 3. **`__triggerSignal__`.** ⚠️ It has a history: the runtime built it and then did not pass it,
 *    so it read as `undefined` inside every block program ever run. It is passed here, and the gate
 *    asserts it *arrives* rather than asserting it is passed.
 * 4. **The reserved names.** `sendSignalOnOutput` refuses `RESERVED_OUTPUTS`, exactly as the
 *    runtime's does. A bench that let a program pulse the node's own `done` would be teaching a
 *    program the app will refuse.
 *
 * ## Containment
 *
 * A bench run cannot reach app state, because there is no app state in this window to reach: the
 * `Noodl` object handed in is built fresh per run from {@link buildSandboxNoodl}. It **can** loop
 * forever and hang the editor, exactly as a block program that loops forever hangs the viewer
 * today; that is recorded, not solved, and it is the same recording `logic-builder-probe.ts` makes
 * one package over.
 *
 * @module BlocklyEditor
 */

import { createBlockRunRecorder } from '@noodl/runtime/src/blockrun';
import { createBlockConsole } from '@noodl/runtime/src/nodes/std-library/logic-builder-console';
import { RESERVED_OUTPUTS } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';
import { previewValue } from '@noodl/runtime/src/tracebuffer';

import type { BlockRunFrame } from './BlockValueTrace';

/**
 * The eleven parameters the runtime compiles `generatedCode` against, in its order.
 *
 * 🔴 **A copy, and knowingly so.** The runtime spells them inline in `_compileFunction` and again
 * in `evaluateFragment`; a third spelling here is not an improvement, and moving the list into a
 * shared module would be a change to the runtime's compile path made for the editor's convenience.
 * What removes the risk is not a shared constant but the gate: the differential fails the day the
 * two lists stop matching, which a shared constant could not detect at all if the *runtime* were
 * the side that changed.
 *
 * ✅ **The gate has now been paid once, which is the argument for it.** FIX-004's redaction ruling
 * added `console` on the runtime side only, and `vfn-011/drift-gate.spec.ts` failed on the arity —
 * having read it off the runtime's own compile rather than off its source. Four spellings exist
 * (`_compileFunction`, `evaluateFragment`, here, and the gate's own literal) and nothing but that
 * differential connects them.
 */
export const LOGIC_BUILDER_PARAMETERS = [
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
  'console'
] as const;

/** The stubbed globals a bench run sees. Seeded, in-memory, thrown away afterwards. */
export interface SandboxNoodl {
  Variables: Record<string, unknown>;
  Objects: Record<string, Record<string, unknown>>;
  Arrays: Record<string, unknown[]>;
}

export interface BenchRunRequest {
  /** The node whose program this is. Only used to address the frame. */
  nodeId: string;
  /** The instrumented program, exactly as the flush produced it. */
  generatedCode: string;
  /**
   * Which signal input the builder pressed.
   *
   * The node's own built-in port passes the lower-case `'run'` and `DEFAULT_HAT_SIGNAL` is the
   * same string, so a bench run of the default hat is indistinguishable from a real one.
   */
  triggerSignal: string;
  /** Sandbox values by input port name. Ports with no value are simply absent, as `Inputs` is. */
  inputs: Record<string, unknown>;
  /** Seeds for the three stubs. Optional: an empty bench is a legitimate bench. */
  seed?: Partial<SandboxNoodl>;
  /** Monotonic, from the bench's own counter. Only its ordering is used. */
  runId: number;
  /** Injected so the frame is reproducible in a spec. */
  now?: number;
}

export interface BenchRunResult {
  /** False when the program failed to compile or threw. */
  ok: boolean;
  /**
   * The run, in **the shape a viewer sends** plus `sandbox: true`.
   *
   * Produced even on the failure path: a run that threw halfway is exactly the run whose hollow
   * blocks are worth seeing, which is the rule `_executeLogic`'s `finally` already states.
   */
  frame: BlockRunFrame;
  /** What the program wrote, minus any reserved name it was refused. */
  outputs: Record<string, unknown>;
  /** The same, in `previewValue`'s display dialect — what the outputs rail paints. */
  outputPreviews: Record<string, string>;
  /** Signal outputs the program pulsed, in order, duplicates included. */
  signals: string[];
  /** Signals refused for naming one of the node's own ports. */
  refusedSignals: string[];
  /** Output *values* refused for the same reason. */
  refusedOutputs: string[];
  /** The stubs as the run left them, so the bench can show what a program changed. */
  sandbox: SandboxNoodl;
  error?: string;
  errorPhase?: 'compile' | 'run';
  /**
   * The block that was executing when the program threw.
   *
   * ⚠️ **The last statement `__s` announced, and that is the strongest claim available.** `__p`
   * wraps a value block and is called *after* its inner expression has evaluated, so a block that
   * threw never reports itself — the innermost probe that fired belongs to a child that succeeded.
   * `__s` fires *before* each statement, so the last one announced is the statement the throw
   * happened inside. Naming the value block would need a try/catch per expression, which would
   * change what the program computes.
   */
  errorBlockId?: string;
}

/**
 * A fresh set of stubs.
 *
 * `Objects` and `Arrays` auto-vivify, because the generated code reaches them by subscript —
 * `Noodl.Objects[id]["prop"]`, `Noodl.Arrays["name"].push(x)` — and in the app those subscripts hit
 * a `Proxy` that mints a Model or a Collection on demand. A plain object would throw on the first
 * property of an unseeded id, which would report the bench's own emptiness as the program's error.
 */
export function buildSandboxNoodl(seed?: Partial<SandboxNoodl>): SandboxNoodl {
  const variables: Record<string, unknown> = { ...(seed?.Variables || {}) };

  const objects = new Proxy({ ...(seed?.Objects || {}) } as Record<string, Record<string, unknown>>, {
    get(target, key: string) {
      if (typeof key !== 'string') return (target as Record<string, unknown>)[key as unknown as string];
      if (!(key in target)) target[key] = {};
      return target[key];
    }
  });

  const arrays = new Proxy({ ...(seed?.Arrays || {}) } as Record<string, unknown[]>, {
    get(target, key: string) {
      if (typeof key !== 'string') return (target as Record<string, unknown>)[key as unknown as string];
      if (!(key in target)) target[key] = [];
      return target[key];
    }
  });

  return { Variables: variables, Objects: objects, Arrays: arrays };
}

/**
 * Compile one program the way the runtime compiles it.
 *
 * Returns `null` and the reason, rather than throwing: a bench that takes the editor down when a
 * program will not compile is worse than a bench that says so — the same rule
 * `logic-builder-probe.ts` states, for the same reason, one package over.
 */
export interface CompiledBenchProgram {
  /**
   * `null` when it would not compile.
   *
   * ⚠️ Not a discriminated union, deliberately: `strictNullChecks` is **off** across this package,
   * so a `fn: null` member narrows nothing and the union would only be documentation that the
   * compiler enforces at neither call site. One optional `error` beside a nullable `fn` is honest
   * about what the types can actually hold here.
   */
  fn: ((...args: unknown[]) => unknown) | null;
  error?: string;
}

export function compileBenchProgram(generatedCode: string): CompiledBenchProgram {
  try {
    const fn = new Function(...LOGIC_BUILDER_PARAMETERS, generatedCode) as (...args: unknown[]) => unknown;
    return { fn };
  } catch (error) {
    return { fn: null, error: 'The blocks could not be compiled: ' + messageOf(error) };
  }
}

/** Run one program on the bench. Never throws. */
export function runOnBench(request: BenchRunRequest): BenchRunResult {
  const sandbox = buildSandboxNoodl(request.seed);
  const outputs: Record<string, unknown> = {};
  const signals: string[] = [];
  const refusedSignals: string[] = [];
  const refusedOutputs: string[] = [];
  const now = request.now === undefined ? Date.now() : request.now;

  const recorder = createBlockRunRecorder();
  let lastStatementId: string | undefined;

  /**
   * The runtime's recorder, with one extra job.
   *
   * Wrapped rather than replaced: the frame this produces has to be the frame a viewer produces,
   * so the counting, the iteration cap and the value dialect stay the runtime's. All this adds is
   * a note of which statement was last announced, which is the only honest answer to "which block
   * threw".
   */
  const probeStatement = (blockId: string) => {
    lastStatementId = blockId;
    recorder.probeStatement(blockId);
  };

  const compiled = compileBenchProgram(request.generatedCode);
  if (!compiled.fn) {
    return {
      ok: false,
      frame: frameFrom(recorder, request.nodeId, request.runId, now),
      outputs,
      outputPreviews: {},
      signals,
      refusedSignals,
      refusedOutputs,
      sandbox,
      error: compiled.error,
      errorPhase: 'compile'
    };
  }

  /**
   * ⚠️ The reserved-name refusal, on the signal side. The runtime guards this door separately from
   * the `Outputs` loop because a `send signal` block reaches port registration through it — and
   * unguarded, a program sending `done` would pulse the *contract's* completion signal. A bench
   * that allowed it would teach a program the app refuses.
   */
  const sendSignalOnOutput = (name: string) => {
    const asString = String(name);
    if (RESERVED_OUTPUTS.indexOf(asString) !== -1) {
      refusedSignals.push(asString);
      return;
    }
    signals.push(asString);
  };

  let error: string | undefined;
  let errorBlockId: string | undefined;

  try {
    compiled.fn(
      request.inputs,
      outputs,
      sandbox,
      sandbox.Variables,
      sandbox.Objects,
      sandbox.Arrays,
      sendSignalOnOutput,
      request.triggerSignal,
      recorder.probeValue,
      probeStatement,
      /**
       * Eleventh (FIX-004 redaction b). A bench run has no run sink — there is no request and no
       * backend here — so this resolves to the real console, exactly as a browser program's does.
       *
       * ⚠️ **The runtime's own factory, not `console` spelled again.** The distinction matters for
       * the same reason the recorder is the runtime's: a bench that named `console` directly would
       * agree with the runtime today and stop agreeing the moment the no-sink case changes, and the
       * drift gate compares arity and behaviour, not the identity of what is passed.
       */
      createBlockConsole(undefined)
    );
  } catch (thrown) {
    error = messageOf(thrown);
    errorBlockId = lastStatementId;
  }

  /**
   * The other door. Reported rather than dropped, and after the loop, so the outputs that *can*
   * land still do — which is the order `_executeLogic` settled on and for the same reason.
   *
   * ⚠️ **A refused output makes the run a failure; a refused signal does not.** That asymmetry is
   * the runtime's, not a choice made here, and it was found by the drift gate rather than by
   * reading: `_executeLogic` calls `_fail` for a reserved output *after* its write loop and
   * returns, so the error stands — while a reserved `send signal` fails from inside
   * `_createExecutionContext` **during** the run, and the success path a few lines later then sets
   * `executionError = null` over it. The node still pulses `Failure`, so the run is reported twice
   * in two directions. Mirrored rather than corrected: the bench's job is to say what the app will
   * do, and a bench that quietly improved on it would be the second truth this file exists to
   * prevent. Filed in NOTES-bench.md.
   */
  for (const name of Object.keys(outputs)) {
    if (RESERVED_OUTPUTS.indexOf(name) !== -1) {
      refusedOutputs.push(name);
      delete outputs[name];
    }
  }

  if (error === undefined && refusedOutputs.length > 0) {
    error =
      '"' + refusedOutputs[0] + '" is one of the node\'s own output ports and cannot be set from the blocks';
  }

  const outputPreviews: Record<string, string> = {};
  for (const name of Object.keys(outputs)) {
    outputPreviews[name] = previewValue(outputs[name]);
  }

  return {
    ok: error === undefined,
    frame: frameFrom(recorder, request.nodeId, request.runId, now),
    outputs,
    outputPreviews,
    signals,
    refusedSignals,
    refusedOutputs,
    sandbox,
    error,
    errorPhase: error === undefined ? undefined : 'run',
    errorBlockId
  };
}

/** The recorder's frame, marked as the bench's. */
function frameFrom(
  recorder: ReturnType<typeof createBlockRunRecorder>,
  nodeId: string,
  runId: number,
  now: number
): BlockRunFrame {
  const frame = recorder.take(nodeId, runId, now) as BlockRunFrame;
  // 🔴 Criterion 7. Without this a sandbox run and a live run are the same object in the same
  // history, and a builder scrubbing back through both has no way to tell which values came from
  // their app and which from values they typed.
  frame.sandbox = true;
  return frame;
}

/**
 * `error.message` alone leaves a `throw "some string"` reporting the empty string — the mistake
 * `logic-builder.ts` records at its own call site, and worth not repeating a third time.
 */
function messageOf(error: unknown): string {
  const message = error && (error as { message?: unknown }).message;
  if (typeof message === 'string' && message !== '') return message;
  const text = String(error);
  return text === '' ? 'The blocks threw, with no message.' : text;
}
