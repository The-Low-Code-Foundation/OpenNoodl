/**
 * VFN-011 — the bench, assembled.
 *
 * Holds the sandbox values, decides what one press of ▶ runs, and hands the resulting frame to the
 * **same** history live frames go into. Everything it needs is somewhere else: the port list is the
 * rails' (`benchModel.ts`), the execution is `BenchRunner.ts`, the drawing is
 * `InterfaceRailsOverlay.ts`, and the code generation is the workspace's own — injected, so this
 * file imports neither Blockly nor the DOM and can be graded in the plain-Node runner.
 *
 * ## 🔴 Why `generate` is injected rather than called here
 *
 * The bench must run *the program the node has*, never a separately generated string, or it is
 * grading something the app will not execute. The one place that produces that string is
 * `BlocklyWorkspace`'s flush, so the flush's own generation expression is passed in and called —
 * the same function, over the same workspace, with the same probes. Reaching for
 * `javascriptGenerator` here would be a second generation path, which is the same defect as a
 * second port list one file over.
 *
 * ⚠️ **It is generated at the moment Run is pressed, not read from the node's parameter.** The two
 * differ for exactly the length of the 300 ms save debounce, and during that window the *blocks on
 * screen* are what the builder means. The node's saved code is what `BlockValueTrace`'s `no-probes`
 * reason is about, and that is a different question with a different answer.
 *
 * @module BlocklyEditor
 */

import { runOnBench } from './BenchRunner';
import type { BenchRunResult } from './BenchRunner';
import { benchInputRows, benchInputsFor, benchOutputRows, benchRunNote, benchTriggers } from './benchModel';
import type { BenchInputRow, BenchOutputRow } from './benchModel';
import type { BlockRunFrame } from './BlockValueTrace';
import type { RailModel } from './interfaceRails';

/** What one press of Run produced, or nothing yet. */
export interface BenchLastRun {
  result: BenchRunResult;
  /** Which signal was pressed. */
  trigger: string;
}

export interface BenchControllerOptions {
  /** The node these blocks belong to. Only used to address the frame. */
  nodeId?: string;
  /** The rails' model, right now. 🔴 Derived per call; never cached here or there. */
  model(): RailModel;
  /**
   * The instrumented program for the blocks as they are, produced by the flush's own generator.
   *
   * `code` is `undefined` when generation **declined** — a cycle in the saved-block graph, a
   * missing definition. That is not "the program is empty"; it means there is no honest JavaScript
   * for these blocks, and the bench must say so rather than run the last string it saw.
   */
  generate(): { code: string | undefined; probedIds: ReadonlySet<string> };
  /** Where a bench frame goes: the same `BlockRunHistory` a viewer frame goes into. */
  publish(frame: BlockRunFrame, note: string, probedIds: ReadonlySet<string>): void;
  /** Something changed that the rails draw. */
  onChanged(): void;
}

/** What the rails need from the bench, and nothing more. */
export interface BenchSurface {
  /** The input rows, each with its cell. */
  inputRows(): BenchInputRow[];
  /** The output rows, each with whatever the last run put in it. */
  outputRows(): BenchOutputRow[];
  /** The builder typed. */
  setText(name: string, text: string): void;
  /** ▶ on a signal row, or the strip's Run button. */
  run(triggerSignal: string): void;
  /** Which signal the strip's Run button should fire, or `undefined` when there is nothing to run. */
  defaultTrigger(): string | undefined;
  /** The last run, for the rails' tone and the block that threw. */
  lastRun(): BenchLastRun | undefined;
}

/**
 * The signal the strip's Run button fires when a program declares none of its own.
 *
 * ⚠️ Lower case, and it is load-bearing twice: it is `DEFAULT_HAT_SIGNAL`, so a program whose only
 * hat is the default one is triggered by exactly the string the app's own `Run` port passes; and it
 * is in `RESERVED_INPUTS`, so it names the port the node already has rather than minting one.
 */
export const DEFAULT_BENCH_TRIGGER = 'run';

export class BenchController implements BenchSurface {
  /**
   * 🔴 **The whole of the bench's state, and it is written to nothing.**
   *
   * Acceptance criterion 8: sandbox values are editor state, not program state. A bench that
   * serialised its inputs into the saved workspace would change the program by testing it, and the
   * change would be invisible — it would diff like an ordinary edit. This map lives for as long as
   * the tab does and dies with it.
   */
  private readonly text = new Map<string, string>();

  private last: BenchLastRun | undefined;
  private runId = 0;

  constructor(private readonly options: BenchControllerOptions) {}

  inputRows(): BenchInputRow[] {
    return benchInputRows(this.options.model(), this.text);
  }

  outputRows(): BenchOutputRow[] {
    const result = this.last?.result;
    return benchOutputRows(this.options.model(), result?.outputPreviews || {}, result?.signals || []);
  }

  setText(name: string, text: string): void {
    if (text === '') this.text.delete(name);
    else this.text.set(name, text);
    // No repaint on a keystroke: the cell is an uncontrolled `<input>` and already shows what was
    // typed. Repainting would move the caret, which is `driving-a-controlled-textarea`'s defect
    // with a different owner.
  }

  defaultTrigger(): string | undefined {
    const declared = benchTriggers(this.options.model());
    return declared.length > 0 ? declared[0] : DEFAULT_BENCH_TRIGGER;
  }

  lastRun(): BenchLastRun | undefined {
    return this.last;
  }

  /**
   * Run the program once, as if `triggerSignal` had fired.
   *
   * Never throws — every failure is a result with a reason in it. A bench that took the editor down
   * when a program threw would be worse than no bench, and the program that throws is exactly the
   * one somebody is trying to fix.
   */
  run(triggerSignal: string): void {
    const generated = this.options.generate();

    /**
     * ⚠️ **Every press produces a run, including the two that never reach the program.**
     *
     * A press that changed nothing at all is indistinguishable from a press that did not land —
     * LGC-002 learned that about a menu item and paid for a pending balloon; this is the same
     * sentence about a button. So a refusal and an empty program both make a frame with nothing in
     * it, carrying a note that says which it was, and it goes into the scrubber like any other.
     */
    if (generated.code === undefined) {
      this.report(
        triggerSignal,
        failedRun(
          this.options.nodeId || '',
          ++this.runId,
          'These blocks could not be turned into a program, so there is nothing to run. ' +
            'A saved block used here may be missing, or two of them may use each other.'
        ),
        // Empty: nothing was probed because nothing was generated, and a stale denominator would
        // paint the program hollow for a run that never happened.
        new Set<string>()
      );
      return;
    }

    if (generated.code.trim() === '') {
      this.report(
        triggerSignal,
        failedRun(this.options.nodeId || '', ++this.runId, 'There are no blocks to run yet.'),
        generated.probedIds
      );
      return;
    }

    const model = this.options.model();
    this.report(
      triggerSignal,
      runOnBench({
        nodeId: this.options.nodeId || '',
        generatedCode: generated.code,
        triggerSignal,
        inputs: benchInputsFor(model, this.text),
        runId: ++this.runId
      }),
      generated.probedIds
    );
  }

  /**
   * One run, recorded and published.
   *
   * The frame goes into the same history the viewer's frames go into, carrying `sandbox: true`, so
   * the scrubber works over sandbox runs (criterion 2) and can still tell them apart (criterion 7).
   */
  private report(trigger: string, result: BenchRunResult, probedIds: ReadonlySet<string>): void {
    this.last = { trigger, result };
    this.options.publish(result.frame, benchRunNote(result), probedIds);
    this.options.onChanged();
  }

  /** The blocks changed, so the last run describes a program that no longer exists. */
  invalidate(): void {
    this.last = undefined;
    this.options.onChanged();
  }
}

/**
 * A run that never reached the program.
 *
 * It still produces a frame, and the frame is still marked as the bench's: a builder who pressed
 * Run is owed an entry in the scrubber saying it happened and did nothing, rather than a press that
 * silently changed nothing at all — which is LGC-002's own "a menu that closes onto nothing is
 * indistinguishable from a menu that did nothing", one surface over.
 */
function failedRun(nodeId: string, runId: number, message: string): BenchRunResult {
  return {
    ok: false,
    frame: { nodeId, runId, t: Date.now(), values: {}, statements: {}, sandbox: true },
    outputs: {},
    outputPreviews: {},
    signals: [],
    refusedSignals: [],
    refusedOutputs: [],
    sandbox: { Variables: {}, Objects: {}, Arrays: {} },
    error: message,
    errorPhase: 'compile'
  };
}
