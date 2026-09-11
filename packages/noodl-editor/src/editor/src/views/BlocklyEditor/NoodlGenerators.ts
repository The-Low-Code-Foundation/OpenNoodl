/**
 * Noodl Code Generators for Blockly
 *
 * Converts Blockly blocks into executable JavaScript code for the Noodl runtime.
 * Generated code has access to:
 * - Inputs: Input values from connections
 * - Outputs: Output values to connections
 * - Noodl.Variables: Global variables
 * - Noodl.Objects: Global objects
 * - Noodl.Arrays: Global arrays
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

import { HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { appConfigReadExpression, APP_CONFIG_BLOCK_TYPE } from './appConfig';
import { libraryReadExpression, LIBRARY_GLOBAL_BLOCK_TYPE } from './appLibraries';
import { initBlockProbes } from './BlockProbes';
import { convertModeExpression } from './convertModes';
import {
  jsonParseExpression,
  jsonStringifyExpression,
  objectHasPropertyExpression,
  objectMembersExpression,
  NEW_OBJECT_EXPRESSION
} from './objectData';
import { windowPathExpression, WINDOW_BLOCK_TYPE } from './windowAccess';

/**
 * Initialize all Noodl code generators
 */
export function initNoodlGenerators() {
  /**
   * LGC-003 §1. **First, and it has to be first.** `addReservedWords` is only read when the
   * generator lazily builds its name database at the first `init()`, so reserving `__p`/`__s`
   * after anything has generated code reserves nothing — see `BlockProbes.initBlockProbes`.
   * It also exempts the four declaration blocks from `STATEMENT_PREFIX`, which needs
   * `initNoodlBlocks` to have registered them, and `initBlocklyIntegration` guarantees that
   * order.
   */
  initBlockProbes();

  // Input/Output generators
  initInputOutputGenerators();

  // Variable generators
  initVariableGenerators();

  // Object generators
  initObjectGenerators();

  // Array generators
  initArrayGenerators();

  // App config generators (VFN-012 §1)
  initAppConfigGenerators();

  // Registered libraries and `window` (VFN-012 §2/§3)
  initBrowserGenerators();

  // Convert and log (FIX-004 §A)
  initUtilityGenerators();

  // Objects as data (FIX-004 §C)
  initObjectDataGenerators();
}

/**
 * Utility Generators (FIX-004 §A)
 */
function initUtilityGenerators() {
  /**
   * Convert — generates `Number(x)` / `String(x)` / `Boolean(x)` / `parseInt(x, 10)` /
   * `parseFloat(x)` from the mode table.
   *
   * `Order.NONE` on the argument so `valueToCode` parenthesises whatever it returns, and
   * `Order.FUNCTION_CALL` on the result because that is what a call expression binds as —
   * without it, `convert of (a) ** 2` would generate the wrong precedence.
   *
   * The empty-socket default is `''` rather than `'null'`: `Number(null)` is `0` and
   * `Boolean(null)` is `false`, both of which are *plausible* answers that hide the mistake,
   * whereas `Number(undefined)` is `NaN` and shows up immediately. An unplugged socket is an
   * unfinished program and should read as one.
   */
  javascriptGenerator.forBlock['noodl_convert'] = function (block) {
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'undefined';
    return [convertModeExpression(block.getFieldValue('MODE'), value), Order.FUNCTION_CALL];
  };

  // Log - generates: console.log(value);
  javascriptGenerator.forBlock['noodl_log'] = function (block) {
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || "''";
    return `console.log(${value});\n`;
  };
}

/**
 * Input/Output Generators
 */
function initInputOutputGenerators() {
  /**
   * LGC-009 — the hat emits nothing, and that is acceptance criterion 1.
   *
   * Blockly's `scrub_` appends the `next` chain to whatever a statement generator returns, so
   * returning `''` here makes a hatted stack generate **byte-identically** to the same stack
   * without the hat — the same lines, in the same order, with the same probe ids. The hat's own
   * id never appears, because `initBlockProbes` marks it `suppressPrefixSuffix` along with the
   * other declaration blocks: it is not a statement of the program, so a `__s(…)` for it would
   * be a mark that teaches nothing.
   *
   * 🔴 **This is where per-hat dispatch would go, and it is deliberately not here.** Wrapping the
   * body in `if (__triggerSignal__ === "<name>") { … }` needs no runtime change — the parameter
   * is already passed — but it would break criterion 1, and it has a trap in it: the node's
   * built-in Run port passes the lower-case `'run'` and Do It passes `PROBE_TRIGGER_SIGNAL`, so
   * a hat named `Run` would match neither and its program would silently stop running. See
   * HAT-DISPATCH in `NOTES-LGC-009.md`.
   */
  javascriptGenerator.forBlock[HAT_BLOCK_TYPE] = function () {
    return '';
  };

  // Define Input - no runtime code (used for I/O detection only)
  javascriptGenerator.forBlock['noodl_define_input'] = function () {
    return '';
  };

  // Get Input - generates: Inputs["name"]
  javascriptGenerator.forBlock['noodl_get_input'] = function (block) {
    const name = block.getFieldValue('NAME');
    const code = `Inputs["${name}"]`;
    return [code, Order.MEMBER];
  };

  // Define Output - no runtime code (used for I/O detection only)
  javascriptGenerator.forBlock['noodl_define_output'] = function () {
    return '';
  };

  // Set Output - generates: Outputs["name"] = value;
  javascriptGenerator.forBlock['noodl_set_output'] = function (block) {
    const name = block.getFieldValue('NAME');
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || 'null';
    return `Outputs["${name}"] = ${value};\n`;
  };

  // Define Signal Input - no runtime code
  javascriptGenerator.forBlock['noodl_define_signal_input'] = function () {
    return '';
  };

  // Define Signal Output - no runtime code
  javascriptGenerator.forBlock['noodl_define_signal_output'] = function () {
    return '';
  };

  // Send Signal - generates: sendSignalOnOutput("name");
  //
  // Bare call, not `this.sendSignalOnOutput`. The runtime compiles this body with
  // `new Function(...)` and invokes it with no receiver, so `this` is the global object in
  // the resulting sloppy-mode scope and the method call throws. `sendSignalOnOutput` is one
  // of the named parameters the runtime passes in, so calling it directly resolves through
  // the function's own scope.
  javascriptGenerator.forBlock['noodl_send_signal'] = function (block) {
    const name = block.getFieldValue('NAME');
    return `sendSignalOnOutput("${name}");\n`;
  };
}

/**
 * Variable Generators
 */
function initVariableGenerators() {
  // Get Variable - generates: Noodl.Variables["name"]
  javascriptGenerator.forBlock['noodl_get_variable'] = function (block) {
    const name = block.getFieldValue('NAME');
    const code = `Noodl.Variables["${name}"]`;
    return [code, Order.MEMBER];
  };

  // Set Variable - generates: Noodl.Variables["name"] = value;
  javascriptGenerator.forBlock['noodl_set_variable'] = function (block) {
    const name = block.getFieldValue('NAME');
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || 'null';
    return `Noodl.Variables["${name}"] = ${value};\n`;
  };
}

/**
 * Object Generators
 */
function initObjectGenerators() {
  // Get Object - generates: Noodl.Objects[id]
  javascriptGenerator.forBlock['noodl_get_object'] = function (block) {
    const id = javascriptGenerator.valueToCode(block, 'ID', Order.NONE) || '""';
    const code = `Noodl.Objects[${id}]`;
    return [code, Order.MEMBER];
  };

  // Get Object Property - generates: object["property"]
  javascriptGenerator.forBlock['noodl_get_object_property'] = function (block) {
    const property = block.getFieldValue('PROPERTY');
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.MEMBER) || '{}';
    const code = `${object}["${property}"]`;
    return [code, Order.MEMBER];
  };

  // Set Object Property - generates: object["property"] = value;
  javascriptGenerator.forBlock['noodl_set_object_property'] = function (block) {
    const property = block.getFieldValue('PROPERTY');
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.MEMBER) || '{}';
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || 'null';
    return `${object}["${property}"] = ${value};\n`;
  };
}

/**
 * Objects-as-data Generators (FIX-004 §C)
 *
 * ## The empty-socket default is `undefined`, and it differs from the two blocks above on purpose
 *
 * `noodl_get_object_property` defaults its unplugged object socket to `'{}'`, so a half-built
 * program reads a property off a fresh empty object and quietly answers `undefined` — a
 * plausible answer that hides the mistake. These blocks default to `undefined` instead, for the
 * reason `noodl_convert` does: `undefined[key]` throws, `logic-builder.ts` catches it into
 * `_fail('logic-builder/blocks-threw', …)`, and the node then says on its `error` output and
 * its `Failure` signal that a socket is empty. An unfinished program should read as one.
 *
 * The existing pair is left alone — changing what a saved program generates is not this task.
 */
function initObjectDataGenerators() {
  javascriptGenerator.forBlock['noodl_new_object'] = function () {
    // Already parenthesised, so it is atomic in every context. See `NEW_OBJECT_EXPRESSION`
    // for why a bare `{}` cannot be used.
    return [NEW_OBJECT_EXPRESSION, Order.ATOMIC];
  };

  // Get property by expression - generates: object[key]
  javascriptGenerator.forBlock['noodl_get_object_property_expr'] = function (block) {
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.MEMBER) || 'undefined';
    const key = javascriptGenerator.valueToCode(block, 'KEY', Order.NONE) || 'undefined';
    return [`${object}[${key}]`, Order.MEMBER];
  };

  // Set property by expression - generates: object[key] = value;
  javascriptGenerator.forBlock['noodl_set_object_property_expr'] = function (block) {
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.MEMBER) || 'undefined';
    const key = javascriptGenerator.valueToCode(block, 'KEY', Order.NONE) || 'undefined';
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || 'null';
    return `${object}[${key}] = ${value};\n`;
  };

  // Object members - generates: Object.keys(object) / Object.values(object)
  javascriptGenerator.forBlock['noodl_object_members'] = function (block) {
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.NONE) || 'undefined';
    return [objectMembersExpression(block.getFieldValue('MODE'), object), Order.FUNCTION_CALL];
  };

  // Has property - generates: Object.prototype.hasOwnProperty.call(object, key)
  // 🔴 Not `key in object`, which is inverted on a Noodl Object. See `objectData.ts`.
  javascriptGenerator.forBlock['noodl_object_has_property'] = function (block) {
    const object = javascriptGenerator.valueToCode(block, 'OBJECT', Order.NONE) || 'undefined';
    const key = javascriptGenerator.valueToCode(block, 'KEY', Order.NONE) || 'undefined';
    return [objectHasPropertyExpression(object, key), Order.FUNCTION_CALL];
  };

  // Read JSON - generates: JSON.parse(text). Throws on malformed text, deliberately.
  javascriptGenerator.forBlock['noodl_json_parse'] = function (block) {
    const text = javascriptGenerator.valueToCode(block, 'TEXT', Order.NONE) || 'undefined';
    return [jsonParseExpression(text), Order.FUNCTION_CALL];
  };

  // JSON text of - generates: JSON.stringify(value)
  javascriptGenerator.forBlock['noodl_json_stringify'] = function (block) {
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'undefined';
    return [jsonStringifyExpression(value), Order.FUNCTION_CALL];
  };
}

/**
 * Array Generators
 */
function initArrayGenerators() {
  // Get Array - generates: Noodl.Arrays["name"]
  javascriptGenerator.forBlock['noodl_get_array'] = function (block) {
    const name = block.getFieldValue('NAME');
    const code = `Noodl.Arrays["${name}"]`;
    return [code, Order.MEMBER];
  };

  // Array Length - generates: array.length
  javascriptGenerator.forBlock['noodl_array_length'] = function (block) {
    const array = javascriptGenerator.valueToCode(block, 'ARRAY', Order.MEMBER) || '[]';
    const code = `${array}.length`;
    return [code, Order.MEMBER];
  };

  // Array Add - generates: array.push(item);
  javascriptGenerator.forBlock['noodl_array_add'] = function (block) {
    const item = javascriptGenerator.valueToCode(block, 'ITEM', Order.NONE) || 'null';
    const array = javascriptGenerator.valueToCode(block, 'ARRAY', Order.MEMBER) || '[]';
    return `${array}.push(${item});\n`;
  };
}

/**
 * App Config Generators (VFN-012)
 */
function initAppConfigGenerators() {
  /**
   * Get App Config — generates `Noodl.Config["key"]`.
   *
   * 🔴 **The key is emitted exactly as stored, whether or not app settings still declare it.**
   * A block left holding a deleted key generates the same code it generated yesterday and reads
   * `undefined` at runtime; it does not silently start reading a *different* variable. VFN-012
   * criterion 2 is a claim about this string, so it is graded on this string.
   *
   * `Order.MEMBER` matches the three neighbouring readers — it is a member access, and declaring
   * it as one is what keeps `a.b.c` from acquiring parentheses.
   */
  javascriptGenerator.forBlock[APP_CONFIG_BLOCK_TYPE] = function (block) {
    const key = block.getFieldValue('KEY') || '';
    return [appConfigReadExpression(key), key ? Order.MEMBER : Order.ATOMIC];
  };
}

/**
 * Library and browser generators (VFN-012 §2 and §3)
 */
function initBrowserGenerators() {
  /**
   * Get a registered library — generates `window.<global>`.
   *
   * 🔴 **The global is emitted exactly as stored, whatever the library scan currently says.**
   * The scan is asynchronous and is empty for the first tick of every session, so a generator
   * that consulted it would rewrite a program depending on when the debounced save happened to
   * fire. VFN-012 criterion 3 is a claim about this string, so it is graded on this string, and
   * nothing here reads the snapshot.
   */
  javascriptGenerator.forBlock[LIBRARY_GLOBAL_BLOCK_TYPE] = function (block) {
    const global = block.getFieldValue('GLOBAL') || '';
    return [libraryReadExpression(global), global ? Order.MEMBER : Order.ATOMIC];
  };

  /**
   * `window` — generates `window["a"]["b"]`.
   *
   * `Order.MEMBER` for the neighbouring readers' reason, and `Order.ATOMIC` for a bare `window`,
   * which is an identifier and binds tighter than anything that could contain it.
   */
  javascriptGenerator.forBlock[WINDOW_BLOCK_TYPE] = function (block) {
    const path = block.getFieldValue('PATH') || '';
    const code = windowPathExpression(path);
    return [code, code === 'window' ? Order.ATOMIC : Order.MEMBER];
  };
}

/**
 * Generate complete JavaScript code from workspace
 *
 * @param workspace - The Blockly workspace
 * @returns Generated JavaScript code
 */
export function generateCode(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace);
}
