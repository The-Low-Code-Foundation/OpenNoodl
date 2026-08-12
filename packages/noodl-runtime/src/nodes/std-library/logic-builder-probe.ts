'use strict';

import { DEFAULT_VALUE_CAP, previewValue } from '../../tracebuffer';

/**
 * LGC-002 — the viewer half of "Do It".
 *
 * The editor generates JavaScript for one block's subtree and sends it here; this compiles it
 * with **the same parameter list `_compileFunction` uses** and runs it against **the same
 * context `_createExecutionContext` builds**, so `Inputs`, `Variables`, `Objects` and `Arrays`
 * resolve exactly as they would mid-run.
 *
 * ⚠️ **Why this is in `@noodl/runtime` and not in the editor.** Turning blocks into code needs
 * Blockly, which only the editor has; the node's live input values exist only in the viewer.
 * Splitting the two the other way round is what made the previous dynamic-port implementation
 * unreachable (LEARNINGS-BLOCKLY.md §1), so the split here is deliberate: **generation is
 * editor-side, execution is viewer-side**, and this file is the execution half.
 *
 * ⚠️ **This does not make a fragment pure.** `Noodl.Variables`, `Noodl.Objects` and
 * `Noodl.Arrays` are the live containers, and a fragment that reaches one of them through a
 * nested block writes to the real app. Two things are contained and they are the two that can
 * be contained cheaply — see {@link evaluateFragment} — and the editor's offer rule
 * (`classifyBlockForDoIt`) is a strong default, not a proof. Nothing here should be read as
 * claiming a sandbox.
 *
 * @module logic-builder-probe
 */

/** Exactly the eight parameters `_compileFunction` compiles against, in that order. */
export interface ProbeExecutionContext {
  Inputs: Record<string, unknown>;
  Outputs: Record<string, unknown>;
  Noodl: unknown;
  Variables: unknown;
  Objects: unknown;
  Arrays: unknown;
  sendSignalOnOutput(name: string): void;
  __triggerSignal__: string;
}

export interface ProbeResult {
  ok: boolean;
  /**
   * The value, rendered in `previewValue`'s **display dialect** — not JSON. Strings are
   * quoted, a Collection prints as `<Collection id>`, `undefined` and `null` are distinct, and
   * the whole thing is capped. Present only when `ok`.
   */
  value?: string;
  /** Present only when `!ok`. Never empty: §4 exists because this node once failed silently. */
  error?: string;
  /** Which half failed. A compile failure is the author's blocks; a run failure is their logic. */
  errorPhase?: 'compile' | 'run';
  /**
   * Signal names the fragment tried to send and this probe swallowed. Reported rather than
   * hidden — a Do It that quietly eats a side effect teaches the wrong thing about the program.
   */
  suppressedSignals?: string[];
}

/** The trigger signal a probe run reports. No signal input caused it, and it must not claim one. */
export const PROBE_TRIGGER_SIGNAL = '__doIt__';

/**
 * Compile and run one generated fragment, and describe what happened.
 *
 * `code` is a complete `new Function` **body** — the editor builds it, because the two pieces
 * it is made of (the generator's helper-function definitions, and the `return (…)` around the
 * expression) are both Blockly's shape, not the runtime's.
 *
 * Two side effects are contained, and only two:
 *
 *  1. **`Outputs` writes go nowhere.** The context's `Outputs` is a throwaway object, and this
 *     never flushes it to the node's ports the way `_executeLogic` does — so a nested
 *     `set output` changes the value on screen not at all.
 *  2. **`sendSignalOnOutput` is replaced with a recorder.** A probe that pulsed a real signal
 *     would run whatever a graph has sequenced behind it, which is the one side effect that can
 *     leave the editor's window entirely.
 *
 * Everything else is the live app. See the module note.
 *
 * ⚠️ **A fragment that loops forever hangs the viewer**, exactly as a block program that loops
 * forever does today. Fixing that needs a worker, and a worker cannot see the node's inputs,
 * which is the whole reason this runs here. Recorded, not solved.
 *
 * Never throws: a diagnostic that takes down the app it is diagnosing is worse than no
 * diagnostic.
 */
export function evaluateFragment(
  context: ProbeExecutionContext,
  code: string,
  valueCap: number = DEFAULT_VALUE_CAP
): ProbeResult {
  if (typeof code !== 'string' || code.trim() === '') {
    // A disabled block, or one whose generator emits nothing, produces an empty fragment.
    // Blockly returns `''` for both, so this is the only place the difference can be named.
    return {
      ok: false,
      errorPhase: 'compile',
      error: 'There is nothing to work out here — this block generates no code.'
    };
  }

  let fn: (...args: unknown[]) => unknown;

  try {
    fn = new Function(
      'Inputs',
      'Outputs',
      'Noodl',
      'Variables',
      'Objects',
      'Arrays',
      'sendSignalOnOutput',
      '__triggerSignal__',
      code
    ) as (...args: unknown[]) => unknown;
  } catch (error) {
    // §4. `_compileFunction` used to swallow exactly this into a `console.error` and return
    // `null`, which is what made a broken block program silent. Returning it is the point.
    return {
      ok: false,
      errorPhase: 'compile',
      error: 'The block could not be compiled: ' + messageOf(error)
    };
  }

  const suppressedSignals: string[] = [];

  try {
    const value = fn(
      context.Inputs,
      context.Outputs,
      context.Noodl,
      context.Variables,
      context.Objects,
      context.Arrays,
      function (name: string) {
        suppressedSignals.push(String(name));
      },
      context.__triggerSignal__
    );

    const result: ProbeResult = { ok: true, value: previewValue(value, valueCap) };
    if (suppressedSignals.length) result.suppressedSignals = suppressedSignals;
    return result;
  } catch (error) {
    const result: ProbeResult = {
      ok: false,
      errorPhase: 'run',
      error: messageOf(error)
    };
    if (suppressedSignals.length) result.suppressedSignals = suppressedSignals;
    return result;
  }
}

/**
 * `error.message` alone left a `throw "some string"` reporting the empty string — the same
 * mistake `_fail`'s call site records, and worth not repeating one file over.
 */
function messageOf(error: unknown): string {
  if (error && typeof (error as { message?: unknown }).message === 'string' && (error as { message: string }).message) {
    return (error as { message: string }).message;
  }
  const text = String(error);
  return text === '' ? 'The block threw, with no message.' : text;
}
