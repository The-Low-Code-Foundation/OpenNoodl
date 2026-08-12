/**
 * The Logic Builder toolbox.
 *
 * Two halves, and the split is deliberate. The Noodl categories at the top are the seam to
 * the surrounding graph — ports, signals, Variables/Objects/Arrays. Everything below is
 * stock Blockly, and it is there because the node graph already teaches dataflow but cannot
 * teach *imperative* structure: sequence, iteration, mutable local state, subroutines. That
 * is the whole reason this node earns its place next to a visual canvas, so the standard
 * categories are not a nice-to-have — they are the point.
 *
 * `Variables` and `Functions` use Blockly's dynamic categories (`custom: 'VARIABLE'` /
 * `'PROCEDURE'`). Those are populated by Blockly itself from the workspace — a plain block
 * list cannot express them, which is why they were previously absent altogether.
 *
 * Block text is localised by Blockly from the loaded locale (see BlocklyLocale.ts); the
 * category names here are the only strings we own, and they follow the editor's language.
 *
 * @module BlocklyEditor
 */

// Type-only: this module is imported by the Settings panel, which is in the main bundle.
// A value import would drag all of Blockly in with it and undo the lazy load.
import type * as Blockly from 'blockly';

/** Category colours. Hues, not hex — Blockly derives block shading from these. */
const HUE = {
  io: '230',
  signals: '180',
  variables: '330',
  objects: '20',
  arrays: '260',
  logic: '210',
  loops: '120',
  math: '230',
  text: '160',
  lists: '260',
  blocklyVariables: '330',
  functions: '290',
  myBlocks: '55'
} as const;

export interface ToolboxLabels {
  noodlInputsOutputs: string;
  noodlSignals: string;
  noodlVariables: string;
  noodlObjects: string;
  noodlArrays: string;
  logic: string;
  loops: string;
  math: string;
  text: string;
  lists: string;
  variables: string;
  functions: string;
  myBlocks: string;
}

/** English category names — the fallback for any locale we have no translation for. */
export const DEFAULT_TOOLBOX_LABELS: ToolboxLabels = {
  noodlInputsOutputs: 'Inputs / Outputs',
  noodlSignals: 'Signals',
  noodlVariables: 'App Variables',
  noodlObjects: 'App Objects',
  noodlArrays: 'App Arrays',
  logic: 'Logic',
  loops: 'Loops',
  math: 'Math',
  text: 'Text',
  lists: 'Lists',
  variables: 'Variables',
  functions: 'Functions',
  // LGC-007 §1: Scratch's own term for custom blocks, tested on millions of
  // non-technical users and plain English. Preferred over "Snippets", "Macros"
  // or "Procedures", all of which are words a builder has to already know.
  myBlocks: 'My Blocks'
};

function category(name: string, colour: string, blocks: string[]) {
  return {
    kind: 'category',
    name,
    colour,
    contents: blocks.map((type) => ({ kind: 'block', type }))
  };
}

/**
 * Build the toolbox.
 *
 * @param labels category names in the active language
 */
export function buildToolbox(labels: ToolboxLabels = DEFAULT_TOOLBOX_LABELS) {
  return {
    kind: 'categoryToolbox',
    contents: [
      /* --- The seam to the node graph ------------------------------------ */
      category(labels.noodlInputsOutputs, HUE.io, [
        'noodl_define_input',
        'noodl_get_input',
        'noodl_define_output',
        'noodl_set_output'
      ]),
      category(labels.noodlSignals, HUE.signals, [
        'noodl_define_signal_input',
        'noodl_define_signal_output',
        'noodl_send_signal'
      ]),
      category(labels.noodlVariables, HUE.variables, ['noodl_get_variable', 'noodl_set_variable']),
      category(labels.noodlObjects, HUE.objects, [
        'noodl_get_object',
        'noodl_get_object_property',
        'noodl_set_object_property'
      ]),
      category(labels.noodlArrays, HUE.arrays, ['noodl_get_array', 'noodl_array_length', 'noodl_array_add']),

      { kind: 'sep' },

      /* --- Stock Blockly: the imperative half ---------------------------- */
      category(labels.logic, HUE.logic, [
        'controls_if',
        'controls_ifelse',
        'logic_compare',
        'logic_operation',
        'logic_negate',
        'logic_boolean',
        'logic_null',
        'logic_ternary'
      ]),
      category(labels.loops, HUE.loops, [
        'controls_repeat_ext',
        'controls_whileUntil',
        'controls_for',
        'controls_forEach',
        'controls_flow_statements'
      ]),
      category(labels.math, HUE.math, [
        'math_number',
        'math_arithmetic',
        'math_single',
        'math_trig',
        'math_constant',
        'math_number_property',
        'math_round',
        'math_modulo',
        'math_constrain',
        'math_random_int',
        'math_random_float'
      ]),
      category(labels.text, HUE.text, [
        'text',
        'text_join',
        'text_append',
        'text_length',
        'text_isEmpty',
        'text_indexOf',
        'text_charAt',
        'text_getSubstring',
        'text_changeCase',
        'text_trim'
      ]),
      category(labels.lists, HUE.lists, [
        'lists_create_with',
        'lists_repeat',
        'lists_length',
        'lists_isEmpty',
        'lists_indexOf',
        'lists_getIndex',
        'lists_setIndex',
        'lists_getSublist',
        'lists_split',
        'lists_sort'
      ]),

      { kind: 'sep' },

      /* --- Dynamic categories Blockly fills in itself --------------------- */
      { kind: 'category', name: labels.variables, colour: HUE.blocklyVariables, custom: 'VARIABLE' },
      { kind: 'category', name: labels.functions, colour: HUE.functions, custom: 'PROCEDURE' },
      // LGC-007: dynamic for the same reason as the two above — its contents change
      // whenever a definition is saved, renamed or deleted, and Blockly rebuilds a
      // `custom` category on every flyout open. `BlocklyWorkspace` registers the
      // callback; a workspace that does not gets an empty category rather than an error.
      // Last, which is both where Scratch puts My Blocks and where this toolbox already
      // keeps its dynamic categories.
      { kind: 'category', name: labels.myBlocks, colour: HUE.myBlocks, custom: 'MY_BLOCKS' }
    ]
  } as Blockly.utils.toolbox.ToolboxDefinition;
}
