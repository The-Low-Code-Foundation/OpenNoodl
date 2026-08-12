/**
 * LGC-004 §1 — the model behind the two interface rails.
 *
 * A Visual Function's signature is real but scattered: a `Define input` here, a `get input`
 * twelve blocks away, a `set output` at the bottom. The rails gather it to the two edges of the
 * workspace so the surface reads as a function rather than as a Blockly file.
 *
 * ## 🔴 The one rule this file exists to enforce
 *
 * **There is no port store.** Every row comes from `detectInterface` in `@noodl/runtime`, which is
 * a projection of the same traversal `detectIO` projects — so the rails and the node's actual
 * ports cannot disagree, because they are reading the same sentence.
 *
 * This is not fastidiousness. `detectIO` lives in the runtime *because* dynamic ports are
 * announced from the **viewer** window, which cannot see anything the editor put on `window`;
 * an editor-side port list is unreachable from the place that needs it, and that is what made the
 * previous implementation dead code (register **L10**). And a rail with its own array would be
 * BLD-007's shape exactly — one fact, two sources, every gate green (register **L11**).
 *
 * So the derivation is: **workspace → JSON → `detectInterface` → rows**, every time, with nothing
 * cached in between. `railModelForWorkspace` re-serialises the live workspace on each call rather
 * than remembering the last answer, and that is deliberate: a cache here would satisfy every test
 * in this repo and be the defect.
 *
 * ## Why this file has no DOM in it
 *
 * The rendering half is `InterfaceRailsOverlay.ts`. This half is a pure function of the workspace,
 * so it is reachable from the plain-Node runner in `tests-unit/` — including the claim that most
 * needs grading, which is that a mutation to the workspace changes the rows.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { detectInterface, type InterfacePort } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { PERMISSIVE_NOODL_TYPE } from './NoodlTypes';

/** The block a drag from the inputs rail creates. */
export const GET_INPUT_BLOCK = 'noodl_get_input';
/** The block a drag from the outputs rail — or a drop onto it — creates. */
export const SET_OUTPUT_BLOCK = 'noodl_set_output';

/**
 * What `'*'` is called in front of a person.
 *
 * ⚠️ **"any", never a guess.** `'*'` is what `detectIO` reports for a port no block declares a
 * type for, which is the common case and a supported one. Printing a plausible type instead —
 * inferring `number` because the block next to it does arithmetic — would state something the node
 * does not do. LGC-004 §3: display it honestly.
 */
export const ANY_TYPE_LABEL = 'any';

/** What a signal port prints as. Signals carry no type; the kind *is* the type. */
export const SIGNAL_TYPE_LABEL = 'signal';

export interface RailRow {
  name: string;
  kind: 'value' | 'signal';
  /** The Noodl type name the node registers for this port, `'*'` included. */
  type: string;
  /** `type`, said in English: `'*'` becomes {@link ANY_TYPE_LABEL}. */
  displayType: string;
  /**
   * `false` when no `Define …` block states this port — an **inferred** row.
   *
   * ⚠️ Inferred is not invalid. `detectIO` counts uses as ports so a program works before anyone
   * declares its interface, and that is a feature to keep (register L12). The row is marked so a
   * builder can *see* the difference and choose to declare; nothing may refuse to show it, grey it
   * out, or require the declaration.
   */
  declared: boolean;
}

export interface RailModel {
  inputs: RailRow[];
  outputs: RailRow[];
}

/**
 * The rows for one serialised workspace.
 *
 * ⚠️ **Takes JSON, not a workspace, on purpose.** A Visual Function that has been placed on the
 * canvas but never opened has no Blockly workspace at all — its blocks are a string in a node
 * parameter — and it still has ports. Anything that wanted to show that node's signature (the
 * props panel, an inspector, a review tool) can call this with the parameter and get the same
 * answer the rails show, without Blockly being loaded.
 */
export function railModelFromWorkspaceJson(workspaceJson: string | object | undefined | null): RailModel {
  const detected = detectInterface(workspaceJson);

  return {
    inputs: detected.inputs.map(toRow),
    outputs: detected.outputs.map(toRow)
  };
}

/**
 * The rows for a live workspace.
 *
 * 🔴 **Re-serialises every call. Do not memoise this.** The rails are refreshed from a Blockly
 * change event, and the entire correctness argument is that the answer is a function of the
 * workspace *now*. A cache keyed on anything cheaper — an edit counter, a block count, the last
 * event type — would return a stale signature after exactly the edits that matter, and would pass
 * every spec that only checks the first render.
 */
export function railModelForWorkspace(workspace: Blockly.Workspace): RailModel {
  return railModelFromWorkspaceJson(Blockly.serialization.workspaces.save(workspace));
}

function toRow(port: InterfacePort): RailRow {
  return {
    name: port.name,
    kind: port.kind,
    type: port.type,
    displayType: displayTypeOf(port),
    declared: port.declared
  };
}

function displayTypeOf(port: InterfacePort): string {
  if (port.kind === 'signal') return SIGNAL_TYPE_LABEL;
  return port.type === PERMISSIVE_NOODL_TYPE ? ANY_TYPE_LABEL : port.type;
}

/**
 * The block JSON a drag off one rail row creates.
 *
 * Bound to the row's name at creation, which is the whole point of dragging from a rail rather
 * than from the toolbox: the toolbox gives you `get input value` and leaves you to retype the
 * name, and a mistyped name silently mints a *second* port rather than failing.
 *
 * ⚠️ Signal rows produce no block. `send signal` writes an output signal and there is no
 * "receive signal" block to write for an input one — a signal input is a *trigger*, and what it
 * runs is the whole program. The overlay therefore does not offer a drag on signal rows rather
 * than offering one that produces the wrong block.
 */
export function dragBlockJsonForRow(row: RailRow, side: 'inputs' | 'outputs'): { type: string; fields: { NAME: string } } | null {
  if (row.kind === 'signal') return null;

  return {
    type: side === 'inputs' ? GET_INPUT_BLOCK : SET_OUTPUT_BLOCK,
    fields: { NAME: row.name }
  };
}

/**
 * A name for a new output port that is not already taken.
 *
 * Used when a value block is dropped on the outputs rail below every row — there is no port to
 * bind to, so one is minted. `result`, then `result2`, `result3`… rather than `result_1`, because
 * the first one has no suffix and a builder reading `result2` knows what the first one is called.
 */
export function unusedOutputName(model: RailModel, base = 'result'): string {
  const taken = new Set(model.outputs.map((row) => row.name));
  if (!taken.has(base)) return base;

  let index = 2;
  while (taken.has(base + index)) index++;
  return base + index;
}
