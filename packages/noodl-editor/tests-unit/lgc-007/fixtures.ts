/**
 * Body fixtures for the My Blocks specs (LGC-007).
 *
 * Everything here is the JSON `Blockly.serialization.workspaces.save()` actually produces —
 * `blocks.blocks` as an array of roots, values nested under `inputs`, statements chained
 * through `next` — so a spec that passes here is asserting against the real shape rather than
 * a convenient one. `inliner.test.ts` closes the loop by loading these into a headless Blockly
 * workspace and generating code from them.
 */

import type { BlocklyBlockJson, BlocklyWorkspaceJson } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import {
  MY_BLOCKS_CALL_STATEMENT,
  MY_BLOCKS_CALL_VALUE
} from '../../src/editor/src/views/BlocklyEditor/myblocks/references';

export function workspace(...roots: BlocklyBlockJson[]): BlocklyWorkspaceJson {
  return { blocks: { languageVersion: 0, blocks: roots } };
}

export function number(value: number): BlocklyBlockJson {
  return { type: 'math_number', fields: { NUM: value } };
}

export function getInput(name: string): BlocklyBlockJson {
  return { type: 'noodl_get_input', fields: { NAME: name } };
}

/** `A op B`, with either socket left open to make a hole. */
export function arithmetic(op: string, a?: BlocklyBlockJson, b?: BlocklyBlockJson): BlocklyBlockJson {
  const inputs: BlocklyBlockJson['inputs'] = {};
  if (a) inputs.A = { block: a };
  if (b) inputs.B = { block: b };
  return { type: 'math_arithmetic', fields: { OP: op }, inputs };
}

export function setOutput(name: string, value?: BlocklyBlockJson, next?: BlocklyBlockJson): BlocklyBlockJson {
  const block: BlocklyBlockJson = { type: 'noodl_set_output', fields: { NAME: name } };
  if (value) block.inputs = { VALUE: { block: value } };
  if (next) block.next = { block: next };
  return block;
}

export function sendSignal(name: string, next?: BlocklyBlockJson): BlocklyBlockJson {
  const block: BlocklyBlockJson = { type: 'noodl_send_signal', fields: { NAME: name } };
  if (next) block.next = { block: next };
  return block;
}

/**
 * A call block.
 *
 * `extraState.args` is what makes a saved body self-describing: the argument names are on the
 * block, so a body that calls another saved block can be analysed with no store present.
 */
export function callValue(defId: string, args: BlocklyBlockJson[] = [], argNames?: string[]): BlocklyBlockJson {
  return call(MY_BLOCKS_CALL_VALUE, defId, args, argNames);
}

export function callStatement(
  defId: string,
  args: BlocklyBlockJson[] = [],
  argNames?: string[],
  next?: BlocklyBlockJson
): BlocklyBlockJson {
  const block = call(MY_BLOCKS_CALL_STATEMENT, defId, args, argNames);
  if (next) block.next = { block: next };
  return block;
}

function call(type: string, defId: string, args: BlocklyBlockJson[], argNames?: string[]): BlocklyBlockJson {
  const names = argNames ?? args.map((_, i) => `arg${i}`);
  const inputs: BlocklyBlockJson['inputs'] = {};
  args.forEach((arg, i) => {
    if (arg) inputs[`ARG${i}`] = { block: arg };
  });
  return { type, extraState: { defId, args: names }, inputs };
}
