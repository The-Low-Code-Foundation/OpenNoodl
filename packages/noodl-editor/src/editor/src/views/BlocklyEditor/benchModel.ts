/**
 * VFN-011 — what the bench holds, and how a typed cell becomes a value.
 *
 * The DOM half is `InterfaceRailsOverlay`, the execution half is `BenchRunner`, and the wiring is
 * `BenchController`. This half is a pure function of a rail model and a map of strings, so it is
 * reachable from the plain-Node runner — including the two claims most worth grading, which are
 * that the bench **enumerates nothing** and **stores nothing in the program**.
 *
 * ## 🔴 The standing constraint this file exists to obey
 *
 * **The bench does not have a list of ports.** It has {@link RailModel}, which is
 * `railModelFromWorkspaceJson`, which is `detectInterface`, which is a projection of the one
 * traversal `detectIO` also projects. A bench "needs the inputs" and it is one line to enumerate
 * them again — that line would be register L11 with a third noun, and phase 59's standing
 * constraint names this task as the one most likely to write it. So {@link benchRowsFor} takes a
 * model and returns rows *of that model*; there is no path through this file that reads a
 * workspace.
 *
 * ## 🔴 The second constraint: a bench that saves its inputs changes the program
 *
 * Acceptance criterion 8. Sandbox values are editor state — a `Map<string, string>` that lives for
 * as long as a tab is open and is written to nothing. Nothing here serialises, nothing here touches
 * a Blockly workspace, and `benchInputsFor` builds a throwaway object per run. A bench that wrote
 * its values into the saved workspace would change the program by testing it, and would do it
 * invisibly, because the diff would look like an ordinary edit.
 *
 * @module BlocklyEditor
 */

import type { RailModel, RailRow } from './interfaceRails';
import { PERMISSIVE_NOODL_TYPE } from './NoodlTypes';

/** One input row, with whatever the builder has typed into it. */
export interface BenchInputRow {
  row: RailRow;
  /** Exactly what is in the cell. Never coerced on the way in — see {@link coerceSandboxValue}. */
  text: string;
  /** `true` once the cell has anything in it, which is what decides whether `Inputs` carries it. */
  hasValue: boolean;
  /** What the cell would send, or `undefined` when it would send nothing. */
  value: unknown;
  /** Set when the text cannot be read as the row's declared type. */
  problem?: string;
}

/** One output row, with whatever the last run put in it. */
export interface BenchOutputRow {
  row: RailRow;
  /** `previewValue`'s display dialect, or `undefined` when the last run wrote nothing here. */
  preview?: string;
  /** True when the last run pulsed this signal output. */
  pulsed?: boolean;
}

/** What a builder has typed, by port name. The whole of the bench's state. */
export type SandboxText = ReadonlyMap<string, string>;

/**
 * Read one cell as the type the row declares.
 *
 * ⚠️ **`'*'` is not "guess".** A row whose type is unknown — which is the common case, because
 * `get input` and `set output` always report `'*'` — is read as **JSON if it parses and as a string
 * if it does not**, which is the rule a person typing into a box would predict: `12` is a number,
 * `hello` is the text "hello", `[1,2]` is an array. The alternative, inferring from the blocks
 * around it, would state a type the node does not have (LGC-004 §3 says so about *printing* a
 * guessed type; typing one in is the same mistake with consequences).
 *
 * A declared type is honoured and a value that cannot be read as it is **reported, not silently
 * coerced**: `Number("abc")` is `NaN`, and a bench that quietly ran a program with `NaN` in it
 * would answer confidently and wrongly, which is worse than not answering.
 */
export function coerceSandboxValue(text: string, type: string): { value: unknown; problem?: string } {
  const trimmed = text.trim();

  switch (type) {
    case 'number': {
      if (trimmed === '') return { value: undefined };
      const value = Number(trimmed);
      if (Number.isNaN(value)) return { value: undefined, problem: 'not a number' };
      return { value };
    }

    case 'boolean': {
      const lowered = trimmed.toLowerCase();
      if (lowered === 'true' || lowered === '1') return { value: true };
      if (lowered === 'false' || lowered === '0' || lowered === '') return { value: false };
      return { value: undefined, problem: 'type true or false' };
    }

    case 'string':
      // Never trimmed and never parsed. A string port asked for the characters in the box, and
      // leading space in a label is a real thing a person tests.
      return { value: text };

    case 'array':
    case 'object': {
      if (trimmed === '') return { value: undefined };
      try {
        const parsed = JSON.parse(trimmed);
        const wanted = type === 'array' ? Array.isArray(parsed) : parsed !== null && typeof parsed === 'object';
        if (!wanted) return { value: undefined, problem: 'not ' + (type === 'array' ? 'an array' : 'an object') };
        return { value: parsed };
      } catch {
        return { value: undefined, problem: 'not valid JSON' };
      }
    }

    default: {
      // `'*'`, `color`, and anything else the blocks named that this does not know. JSON when it
      // parses, the raw characters when it does not.
      if (trimmed === '') return { value: undefined };
      try {
        return { value: JSON.parse(trimmed) };
      } catch {
        return { value: text };
      }
    }
  }
}

/**
 * The input rows of a rail model, each carrying its cell.
 *
 * Signal rows are included: a signal input is a **trigger**, not a value, and the rail draws a ▶
 * on it rather than a box. Filtering them out here would make the bench's list a different list
 * from the rails' list, which is the whole thing this file refuses to do.
 */
export function benchInputRows(model: RailModel, text: SandboxText): BenchInputRow[] {
  return model.inputs.map((row) => {
    const raw = row.kind === 'signal' ? '' : text.get(row.name) || '';
    if (row.kind === 'signal' || raw === '') {
      return { row, text: raw, hasValue: false, value: undefined };
    }

    const read = coerceSandboxValue(raw, row.type === PERMISSIVE_NOODL_TYPE ? PERMISSIVE_NOODL_TYPE : row.type);
    return { row, text: raw, hasValue: read.problem === undefined, value: read.value, problem: read.problem };
  });
}

/**
 * The `Inputs` object one bench run is handed.
 *
 * ⚠️ **A port with an empty cell is absent, not `undefined`.** `Inputs` in the app is
 * `_internal.inputValues`, which only carries ports something has actually written to, so a
 * program testing `Inputs["x"] === undefined` behaves the same on the bench as in the app only if
 * the bench leaves the key off. Writing `undefined` under every declared name would look identical
 * in every spec and differ under `in` and `Object.keys`.
 *
 * 🔴 A fresh object per run. Handing the same object twice would let one run see what the previous
 * one wrote to `Inputs`, which the app never does.
 */
export function benchInputsFor(model: RailModel, text: SandboxText): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  for (const row of benchInputRows(model, text)) {
    if (row.row.kind === 'signal') continue;
    if (!row.hasValue) continue;
    inputs[row.row.name] = row.value;
  }

  return inputs;
}

/** Every signal input the program has — the rows that get a ▶. */
export function benchTriggers(model: RailModel): string[] {
  return model.inputs.filter((row) => row.kind === 'signal').map((row) => row.name);
}

/**
 * The output rows, filled in from a run.
 *
 * `previews` and `signals` come from a {@link BenchRunResult}; both are read by name, so an output
 * the program wrote that the rail does not list simply does not appear — which is correct, because
 * the rail lists the ports the *node* has and a run cannot mint one.
 */
export function benchOutputRows(
  model: RailModel,
  previews: Readonly<Record<string, string>>,
  signals: readonly string[]
): BenchOutputRow[] {
  return model.outputs.map((row) => {
    if (row.kind === 'signal') {
      return { row, pulsed: signals.indexOf(row.name) !== -1 };
    }
    const preview = previews[row.name];
    return preview === undefined ? { row } : { row, preview };
  });
}

/**
 * The one sentence every sandbox surface carries — acceptance criterion 3.
 *
 * ⚠️ **A constant, so it cannot be said in three dialects.** The cost of running in the editor was
 * accepted on the condition that it is *stated in the UI, not hidden*, and a rule enforced by three
 * separate string literals is a rule that decays the first time one of them is edited.
 */
export const SANDBOX_NOTE = 'sandbox — not your app’s data';

/**
 * What the strip says after a bench run, so the scrubber is never ambiguous about what it is
 * showing. Criterion 7's editor-side half.
 */
export function benchRunNote(result: { ok: boolean; error?: string; errorBlockId?: string }): string {
  if (result.ok) return 'Sandbox run — ' + SANDBOX_NOTE + '.';
  return 'Sandbox run failed: ' + (result.error || 'the blocks threw, with no message.');
}
