'use strict';

/**
 * LGC-003 §1 — the viewer half of the pushed probe.
 *
 * The editor instruments the one string the runtime executes: every value block's expression
 * is wrapped in `__p(id, value)` and every statement is preceded by `__s(id)`
 * (`BlocklyEditor/BlockProbes.ts`). This file is what those two names resolve to.
 *
 * ⚠️ **This is not the trace buffer and it must never become part of it.** `tracebuffer.ts` is
 * the app-wide edge log behind the Provenance panel, armed by a switch two peers share
 * (`NodeContext.setTraceEnabled`), and TALK-003 recorded that arming it destroys a human's
 * in-progress recording — HUD-004 paid for an ownership set to stop that. Block tracing
 * declines the whole question: its own switch, its own per-node set, its own frames. Nothing
 * here can clobber a recording because nothing here can reach one. The one thing it borrows is
 * `previewValue`, because a value's **display dialect** should not have two spellings.
 *
 * @module blockrun
 */

import { DEFAULT_VALUE_CAP, previewValue } from './tracebuffer';

/**
 * LGC-003 §1 — the value probe and the statement probe, as the compiled program sees them.
 *
 * `__p(id, value)` **returns `value`, unchanged and by reference.** That is the whole safety
 * argument for instrumenting the one string the runtime actually executes: the instrumented
 * program computes exactly what the bare one computes. `__s(id)` returns nothing.
 */
export type BlockValueProbe = (blockId: string, value: unknown) => unknown;
export type BlockStatementProbe = (blockId: string) => void;

/**
 * The probes a program runs against when nobody is watching.
 *
 * ⚠️ **Module-level constants, deliberately.** They are handed to every uninstrumented run of
 * every Logic Builder in the app, so they must be one shared pair of monomorphic functions
 * rather than a closure minted per run — and `IDENTITY_VALUE_PROBE` must accumulate nothing at
 * all. "Nothing accumulates when unattached" is an acceptance criterion, and it is asserted
 * rather than assumed: there is no state here for anything to accumulate into.
 */
export const IDENTITY_VALUE_PROBE: BlockValueProbe = function (_blockId, value) {
  return value;
};
export const NOOP_STATEMENT_PROBE: BlockStatementProbe = function () {
  /* nothing is watching */
};

/**
 * How many of a loop's iterations one block keeps values for.
 *
 * §5.2 wants "the last plus ×12, click to scrub iterations". A loop of ten thousand cannot
 * keep ten thousand previews, so the cap keeps the first `ITERATION_CAP - 1` and always
 * overwrites the last slot with the newest — so the **last iteration is always the last
 * entry**, which is what the badge shows by default, and the middle of a long loop is what
 * goes missing. `n` is never capped, so the count stays truthful.
 */
export const ITERATION_CAP = 25;

/** How many distinct blocks one run will report on. Bounds the frame, not the program. */
export const BLOCK_CAP = 400;

/** One run's worth of block values, ready to go over the relay. */
export interface BlockRunFrame {
  nodeId: string;
  runId: number;
  t: number;
  values: Record<string, { n: number; v: string[] }>;
  statements: Record<string, number>;
  truncated?: boolean;
}

export interface BlockRunRecorder {
  probeValue: BlockValueProbe;
  probeStatement: BlockStatementProbe;
  /** Format everything and hand back the frame. Called once, synchronously after the run. */
  take(nodeId: string, runId: number, now: number): BlockRunFrame;
}

/**
 * Record one run.
 *
 * ⚠️ **Raw values are held and formatted at {@link BlockRunRecorder.take}, not at each hit.**
 * A loop of five hundred would otherwise pay five hundred `previewValue` walks for values
 * nobody will read, on a node the user is watching — the strobe §5.3 warns about, moved into
 * the runtime where a frame budget cannot rescue it. The cost of doing it this way is one real
 * inaccuracy and it is named rather than hidden: **a program that mutates an object it also
 * reports shows that object's state at the end of the run, not at the iteration it was
 * recorded.** Both `take` and the run itself are synchronous inside `_executeLogic`, so
 * nothing outside the run can move underneath it.
 */
export function createBlockRunRecorder(valueCap: number = DEFAULT_VALUE_CAP): BlockRunRecorder {
  const values = new Map<string, { n: number; raw: unknown[] }>();
  const statements = new Map<string, number>();
  let truncated = false;

  const probeValue: BlockValueProbe = function (blockId, value) {
    let entry = values.get(blockId);
    if (entry === undefined) {
      if (values.size >= BLOCK_CAP) {
        truncated = true;
        return value;
      }
      entry = { n: 0, raw: [] };
      values.set(blockId, entry);
    }

    entry.n++;
    if (entry.raw.length < ITERATION_CAP) entry.raw.push(value);
    else entry.raw[ITERATION_CAP - 1] = value;

    return value;
  };

  const probeStatement: BlockStatementProbe = function (blockId) {
    const seen = statements.get(blockId);
    if (seen === undefined) {
      if (statements.size >= BLOCK_CAP) {
        truncated = true;
        return;
      }
      statements.set(blockId, 1);
      return;
    }
    statements.set(blockId, seen + 1);
  };

  return {
    probeValue,
    probeStatement,
    take(nodeId, runId, now) {
      const frame: BlockRunFrame = {
        nodeId: nodeId,
        runId: runId,
        t: now,
        values: {},
        statements: {}
      };

      values.forEach((entry, blockId) => {
        frame.values[blockId] = { n: entry.n, v: entry.raw.map((value) => previewValue(value, valueCap)) };
      });
      statements.forEach((count, blockId) => {
        frame.statements[blockId] = count;
      });

      if (truncated) frame.truncated = true;
      return frame;
    }
  };
}

