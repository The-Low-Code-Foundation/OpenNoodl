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

// A plain string constant out of the runtime's pure port detector — no Blockly, nothing to
// drag in, so the lazy load above is unaffected.
import { HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

// Two string constants and a category id out of a module that imports nothing but a type — the
// lazy load above is unaffected.
import { APP_CONFIG_CATEGORY, APP_CONFIG_HUE } from './appConfig';
import { BROWSER_CATEGORY, BROWSER_HUE } from './appLibraries';

/** Category colours. Hues, not hex — Blockly derives block shading from these. */
const HUE = {
  io: '230',
  signals: '180',
  variables: '330',
  objects: '20',
  arrays: '260',
  appConfig: APP_CONFIG_HUE,
  browser: BROWSER_HUE,
  logic: '210',
  loops: '120',
  math: '230',
  text: '160',
  lists: '260',
  // FIX-004 §A — red, and unused by any other category. A diagnostic block should not be
  // mistakable at a glance for a block that does the app's work.
  debug: '0',
  blocklyVariables: '330',
  functions: '290',
  myBlocks: '55'
} as const;

export interface ToolboxLabels {
  noodlInputsOutputs: string;
  noodlSignals: string;
  /**
   * ⚠️ **`Noodl.Variables`, not the app's config.** This was called *App Variables* until
   * VFN-012, which is the name a builder reads as *"the variables I declared in app settings"* —
   * a different bag entirely, now under {@link ToolboxLabels.noodlAppConfig}. The label changed;
   * the block type ids `noodl_get_variable` / `noodl_set_variable` did not, and must not.
   */
  noodlVariables: string;
  noodlObjects: string;
  noodlArrays: string;
  /** VFN-012 §1 — `Noodl.Config`: declared in app settings, typed, read only at runtime. */
  noodlAppConfig: string;
  /**
   * VFN-012 §2/§3 — the libraries this app registered, and `window`.
   *
   * One category for both because they are the same escape hatch at two levels of ceremony: a
   * registered library generates `window.<global>` and the browser block generates
   * `window["a"]["b"]`. The report asked for them in one sentence, too.
   */
  noodlLibraries: string;
  logic: string;
  loops: string;
  math: string;
  text: string;
  lists: string;
  /** FIX-004 §A — `console.log`, given a findable home of its own. */
  debug: string;
  variables: string;
  functions: string;
  myBlocks: string;
}

/** English category names — the fallback for any locale we have no translation for. */
export const DEFAULT_TOOLBOX_LABELS: ToolboxLabels = {
  noodlInputsOutputs: 'Inputs / Outputs',
  noodlSignals: 'Signals',
  noodlVariables: 'Runtime Variables',
  noodlObjects: 'App Objects',
  noodlArrays: 'App Arrays',
  noodlAppConfig: 'App Config',
  noodlLibraries: 'Libraries & Browser',
  logic: 'Logic',
  loops: 'Loops',
  math: 'Math',
  text: 'Text',
  lists: 'Lists',
  debug: 'Debug',
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
        // LGC-009 — first, because it is where a program starts. Scratch and MakeCode both put
        // the hat at the top of the first category a beginner opens, for the same reason: the
        // commonest question in any block tool is "why didn't this run?", and the answer is
        // easier to reach for than to explain.
        HAT_BLOCK_TYPE,
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
      /**
       * VFN-012 — the app's own declared config variables, where Richard asked for them: beside
       * App Objects and App Arrays, at the bottom of the seam to the graph.
       *
       * `custom`, like `VARIABLE` / `PROCEDURE` / `MY_BLOCKS`, because its contents are the
       * project's app settings and those change under an open editor. `BlocklyWorkspace`
       * registers the callback; a workspace that does not gets an empty category rather than an
       * error, which is why the callback's own empty state has to be distinguishable from it —
       * see `hasAppConfigEmptyState`.
       */
      { kind: 'category', name: labels.noodlAppConfig, colour: HUE.appConfig, custom: APP_CONFIG_CATEGORY },
      /**
       * VFN-012 §2/§3 — the libraries the app registered, and `window`. Last in the seam,
       * because it is the seam to everything *outside* Noodl rather than to the node graph.
       *
       * `custom` for App Config's reason and one more: the library list is read off disk
       * asynchronously, so the contents are not merely stale-able, they are *unknown* for the
       * first tick of a session — see the tri-state snapshot in `appLibraries.ts`. A static
       * category could not express that at all.
       */
      { kind: 'category', name: labels.noodlLibraries, colour: HUE.browser, custom: BROWSER_CATEGORY },

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
        // FIX-004 §A — first after the literal, because "I wasn't able to use a Number()
        // operator to turn a string into a number" is a question asked *in* this category.
        // It also appears under Text, which is the other place an author goes looking.
        'noodl_convert',
        'math_single',
        'math_trig',
        'math_constant',
        'math_number_property',
        'math_round',
        'math_modulo',
        'math_constrain',
        // FIX-004 §B — already registered by Blockly; one toolbox line each.
        'math_change',
        'math_on_list',
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
        'text_trim',
        // FIX-004 §B
        'text_replace',
        'text_reverse',
        'text_count',
        // FIX-004 §A — the same block as under Math. A conversion is reached for from
        // whichever side the author is standing on, and Blockly is happy to list one block
        // type in two flyouts.
        'noodl_convert'
      ]),
      category(labels.lists, HUE.lists, [
        // FIX-004 §B
        'lists_create_empty',
        'lists_create_with',
        'lists_repeat',
        'lists_length',
        'lists_isEmpty',
        'lists_indexOf',
        'lists_getIndex',
        'lists_setIndex',
        'lists_getSublist',
        'lists_split',
        'lists_sort',
        // FIX-004 §B
        'lists_reverse'
      ]),
      /**
       * FIX-004 §A — Debug.
       *
       * A category of one, which is the right size for it: *"there's no log block"* was a
       * complaint about **finding** one, and a log block filed under Logic or Inputs/Outputs is
       * a log block nobody finds. Block languages this node's audience have met put it in its
       * own place for the same reason.
       */
      category(labels.debug, HUE.debug, ['noodl_log']),

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
