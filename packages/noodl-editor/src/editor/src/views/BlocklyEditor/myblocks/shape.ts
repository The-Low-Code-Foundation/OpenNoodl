/**
 * Shape follows purity (LGC-007 §1), and the signature that decides it.
 *
 * §1 and register L21 are settled and are not reopened here: Blockly's own grammar already
 * says pure-with-one-output from effectful, users already read it, and we do not invent a
 * visual language for something the toolkit says for free. So the whole job of this file is to
 * decide which of Blockly's two existing shapes a saved group gets:
 *
 * - **value** — one root, that root has an output plug, nothing is stacked after it, and no
 *   block in the group is a signal block. Drops inside `a + …`.
 * - **statement** — anything else. Stacks, and cannot be dropped mid-expression.
 *
 * Note what falls out for free: a group whose root has an output plug *cannot* contain a
 * statement block, because a statement block has nowhere to attach inside a value tree. So
 * "pure" and "the root has an output" are the same predicate over our block set, and the
 * separate signal check exists only so the reason we report to the user names the real cause
 * ("it sends a signal") rather than a structural restatement of it.
 *
 * ## The schema seam
 *
 * A serialised Blockly workspace records *structure*, not *connection shapes*: an absent input
 * simply is not in the JSON, and a lone root gives no clue whether it is an expression or a
 * statement. So shape inference needs to know, per block type, whether it has an output plug
 * and what its value inputs are called. That knowledge is injected (`BlockSchema`) rather than
 * hardcoded:
 *
 * - in the editor, `blocklyBlockSchema()` answers from Blockly itself, which is authoritative
 *   and free — at save time we are holding the real blocks;
 * - in a test, a fake answers, so none of this needs a renderer;
 * - `STATIC_BLOCK_SCHEMA` below is the fallback for both, covering our fifteen blocks and the
 *   stock toolbox. ⚠️ An unknown type falls back to "statement, no value inputs", which is the
 *   safe direction (a value group misfiled as a statement is usable; the reverse generates
 *   nonsense) but is still wrong, which is why the editor path asks Blockly and does not rely
 *   on the table.
 *
 * @module BlocklyEditor/myblocks
 */

import type { BlocklyBlockJson, BlocklyWorkspaceJson, MyBlockHolePath, MyBlockParam, MyBlockShape } from './format';
import { newId } from './format';
import { argInputName, isMyBlocksCall, walkWorkspace } from './references';

export interface BlockSchema {
  /** Does a block of this type have an output plug? */
  hasOutput(type: string): boolean;
  /** The names of its value inputs, in the order they are rendered. */
  valueInputs(type: string): string[];
  /** Does it send, declare or handle a signal? Only ever changes the *reason*, not the shape. */
  isSignal(type: string): boolean;
}

/** The three blocks that make a group effectful in the node graph's sense. */
const SIGNAL_TYPES = new Set(['noodl_send_signal', 'noodl_define_signal_input', 'noodl_define_signal_output']);

/**
 * Block types that produce a value, with the value inputs each one takes.
 *
 * Our fifteen come from `NoodlBlocks.ts`; the stock entries are the ones in `BlocklyToolbox.ts`.
 * This table is a fallback and a test fixture, not the authority — see the schema seam above.
 */
const VALUE_BLOCKS: Record<string, string[]> = {
  // --- Noodl ---
  noodl_get_input: [],
  noodl_get_variable: [],
  noodl_get_object: ['ID'],
  noodl_get_object_property: ['OBJECT'],
  noodl_get_array: [],
  noodl_array_length: ['ARRAY'],
  // --- stock: logic ---
  logic_compare: ['A', 'B'],
  logic_operation: ['A', 'B'],
  logic_negate: ['BOOL'],
  logic_boolean: [],
  logic_null: [],
  logic_ternary: ['IF', 'THEN', 'ELSE'],
  // --- stock: math ---
  math_number: [],
  math_arithmetic: ['A', 'B'],
  math_single: ['NUM'],
  math_trig: ['NUM'],
  math_constant: [],
  math_number_property: ['NUMBER_TO_CHECK'],
  math_round: ['NUM'],
  math_modulo: ['DIVIDEND', 'DIVISOR'],
  math_constrain: ['VALUE', 'LOW', 'HIGH'],
  math_random_int: ['FROM', 'TO'],
  math_random_float: [],
  // --- stock: text ---
  text: [],
  text_length: ['VALUE'],
  text_isEmpty: ['VALUE'],
  text_indexOf: ['VALUE', 'FIND'],
  text_charAt: ['VALUE', 'AT'],
  text_getSubstring: ['STRING', 'AT1', 'AT2'],
  text_changeCase: ['TEXT'],
  text_trim: ['TEXT'],
  // --- stock: lists ---
  lists_repeat: ['ITEM', 'NUM'],
  lists_length: ['VALUE'],
  lists_isEmpty: ['VALUE'],
  lists_indexOf: ['VALUE', 'FIND'],
  lists_getIndex: ['VALUE', 'AT'],
  lists_getSublist: ['LIST', 'AT1', 'AT2'],
  lists_split: ['INPUT'],
  lists_sort: ['LIST'],
  variables_get: []
};

/** Statement blocks and the value inputs they take. */
const STATEMENT_BLOCKS: Record<string, string[]> = {
  noodl_define_input: [],
  noodl_define_output: [],
  noodl_set_output: ['VALUE'],
  noodl_define_signal_input: [],
  noodl_define_signal_output: [],
  noodl_send_signal: [],
  noodl_set_variable: ['VALUE'],
  noodl_set_object_property: ['OBJECT', 'VALUE'],
  noodl_array_add: ['ITEM', 'ARRAY'],
  controls_if: ['IF0'],
  controls_ifelse: ['IF0'],
  controls_repeat_ext: ['TIMES'],
  controls_whileUntil: ['BOOL'],
  controls_for: ['FROM', 'TO', 'BY'],
  controls_forEach: ['LIST'],
  controls_flow_statements: [],
  text_append: ['TEXT'],
  lists_setIndex: ['LIST', 'AT', 'TO'],
  variables_set: ['VALUE'],
  math_change: ['DELTA']
};

export const STATIC_BLOCK_SCHEMA: BlockSchema = {
  hasOutput(type) {
    return Object.prototype.hasOwnProperty.call(VALUE_BLOCKS, type);
  },
  valueInputs(type) {
    return VALUE_BLOCKS[type] || STATEMENT_BLOCKS[type] || [];
  },
  isSignal(type) {
    return SIGNAL_TYPES.has(type);
  }
};

/**
 * A schema that answers for call blocks from the block's own `extraState` and defers
 * everything else to `base`.
 *
 * A call block's inputs depend on the definition it points at, so no static table can hold
 * them. It records its own argument names when it is serialised (`extraState.args`), which
 * makes a saved body self-describing: a definition that calls another definition can be
 * analysed without the store being present.
 */
export function schemaWithCalls(base: BlockSchema = STATIC_BLOCK_SCHEMA): BlockSchema {
  return {
    hasOutput(type) {
      if (type === 'myblocks_call_value') return true;
      if (type === 'myblocks_call_statement') return false;
      return base.hasOutput(type);
    },
    valueInputs(type) {
      // Handled per-block by `valueInputsOf` below, which can see `extraState`.
      return base.valueInputs(type);
    },
    isSignal: base.isSignal
  };
}

/** The value inputs of one concrete block, which for a call block means reading `extraState`. */
export function valueInputsOf(block: BlocklyBlockJson, schema: BlockSchema): string[] {
  if (isMyBlocksCall(block)) {
    const args = (block.extraState as Record<string, unknown> | undefined)?.args;
    const count = Array.isArray(args) ? args.length : 0;
    const names: string[] = [];
    for (let i = 0; i < count; i++) names.push(argInputName(i));
    return names;
  }
  return schema.valueInputs(block.type);
}

export interface InferredSignature {
  shape: MyBlockShape;
  params: MyBlockParam[];
  /** Plain-English reasons for the shape, in the order they were decided. For the save dialog. */
  reasons: string[];
  /** How many outputs the group writes. Reported so §1's "several outputs" can be explained. */
  outputCount: number;
}

/**
 * Infer the shape and the parameter list of a saved group.
 *
 * Parameters are the group's **empty value inputs** — the holes a builder left open. That is
 * the whole parameter story in this version, and it is the one that matches how the feature
 * reads: you select `round(  )`, save it, and the block you get back has one socket. A shadow
 * block in a socket counts as *filled*, because a shadow is a default value the user can see
 * and overtype, not a hole.
 */
export function inferSignature(
  body: BlocklyWorkspaceJson | undefined | null,
  schema: BlockSchema = schemaWithCalls()
): InferredSignature {
  const roots = body?.blocks?.blocks;
  const reasons: string[] = [];
  const params: MyBlockParam[] = [];

  let sawSignal = false;
  let outputCount = 0;

  const usedNames = new Set<string>();

  walkWorkspace(body, ({ block, path, shadow }) => {
    if (shadow) return;

    if (schema.isSignal(block.type)) sawSignal = true;
    if (block.type === 'noodl_set_output' || block.type === 'noodl_define_output') outputCount++;

    for (const input of valueInputsOf(block, schema)) {
      const filled = block.inputs?.[input]?.block || block.inputs?.[input]?.shadow;
      if (filled) continue;

      const hole: MyBlockHolePath = path.concat(`i:${input}`);
      params.push({
        id: newId('p'),
        name: uniqueParamName(input, usedNames),
        type: '*',
        hole
      });
    }
  });

  if (!Array.isArray(roots) || roots.length === 0) {
    return { shape: 'statement', params: [], reasons: ['it has no blocks in it'], outputCount: 0 };
  }

  let shape: MyBlockShape = 'value';

  if (roots.length > 1) {
    reasons.push(`it is ${roots.length} separate stacks, not one expression`);
    shape = 'statement';
  }
  if (sawSignal) {
    reasons.push('it sends or declares a signal');
    shape = 'statement';
  }
  if (outputCount > 1) {
    reasons.push(`it writes ${outputCount} outputs`);
    shape = 'statement';
  }
  if (shape === 'value' && !schema.hasOutput(roots[0].type)) {
    reasons.push('its first block is something you do, not a value');
    shape = 'statement';
  }
  if (shape === 'value' && roots[0].next?.block) {
    reasons.push('it has blocks stacked after it');
    shape = 'statement';
  }

  if (shape === 'value') {
    reasons.push('it produces one value and changes nothing');
  }

  return { shape, params, reasons, outputCount };
}

function uniqueParamName(input: string, used: Set<string>): string {
  const base = input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || 'value';
  let name = base;
  let n = 2;
  while (used.has(name)) {
    name = `${base} ${n}`;
    n++;
  }
  used.add(name);
  return name;
}
