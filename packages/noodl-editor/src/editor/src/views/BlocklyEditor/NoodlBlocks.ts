/**
 * Noodl Custom Blocks for Blockly
 *
 * Defines custom blocks for Noodl-specific functionality:
 * - Inputs/Outputs (node I/O)
 * - Variables (Noodl.Variables)
 * - Objects (Noodl.Objects)
 * - Arrays (Noodl.Arrays)
 * - Events/Signals
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { DEFAULT_HAT_SIGNAL, HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import {
  appConfigKeyDisplay,
  appConfigKeyOptions,
  appConfigTooltip,
  appConfigVariables,
  APP_CONFIG_BLOCK_TYPE,
  APP_CONFIG_HUE,
  defaultConfigKey
} from './appConfig';
import {
  defaultLibraryGlobal,
  libraryGlobalDisplay,
  libraryGlobalOptions,
  libraryTooltip,
  registeredLibrariesSnapshot,
  BROWSER_HUE,
  LIBRARY_GLOBAL_BLOCK_TYPE
} from './appLibraries';
import {
  convertModeCheck,
  convertModeOptions,
  convertModeTooltip,
  DEFAULT_CONVERT_MODE
} from './convertModes';
import { blocklyCheckForNoodlType, connectionCheckForDeclaredPort, PERMISSIVE_NOODL_TYPE } from './NoodlTypes';
import {
  objectMembersOptions,
  objectMembersTooltip,
  DEFAULT_OBJECT_MEMBERS_MODE,
  JSON_PARSE_TOOLTIP,
  JSON_STRINGIFY_TOOLTIP
} from './objectData';
import { windowTooltip, DEFAULT_WINDOW_PATH, WINDOW_BLOCK_TYPE } from './windowAccess';

/**
 * Shorthand for a check a block knows statically, spelled in Noodl's vocabulary so the map in
 * `NoodlTypes.ts` stays the only place the two type names are paired. Every call below
 * resolves to the string that block already shipped — this single-sources them, it does not
 * change them.
 */
const check = blocklyCheckForNoodlType;

/**
 * The declared type of a named port, read off the `Define …` blocks in the same workspace.
 *
 * `get input` and `set output` name a port but do not type it — the type lives on a
 * *different* block, the matching `Define input` / `Define output`. `detectIO` resolves the
 * same way on the serialised side ("a declaration wins on type because it is the only place a
 * type is stated"); this is the live-workspace half of it.
 *
 * Two declarations of the same name that disagree read as `'*'`. Refusing to pick a winner is
 * deliberate: `detectIO` resolves such a clash by document order, which is not something an
 * author can see, and a check derived from an invisible tie-break is worse than no check.
 */
function declaredTypeOfPort(block: Blockly.Block, defineBlockType: string, portName: string): string {
  const workspace = block.workspace;
  if (!workspace || !portName) return PERMISSIVE_NOODL_TYPE;

  let declared: string | null = null;

  for (const candidate of workspace.getBlocksByType(defineBlockType, false)) {
    if (candidate.getFieldValue('NAME') !== portName) continue;
    const type = candidate.getFieldValue('TYPE') || PERMISSIVE_NOODL_TYPE;
    if (declared !== null && declared !== type) return PERMISSIVE_NOODL_TYPE;
    declared = type;
  }

  return declared || PERMISSIVE_NOODL_TYPE;
}

function sameCheck(current: string[] | null, next: string[] | null): boolean {
  if (current === null || next === null) return current === next;
  return current.length === next.length && current.every((value, i) => value === next[i]);
}

/**
 * Put a check on a connection — but never at the cost of a wire that is already there.
 *
 * ⚠️ The migration guard, and the reason this task did not have to become one.
 * `Connection.setCheck` disconnects whatever is attached if the new check no longer admits
 * it, silently. A saved program authored before checks existed can hold a pairing this map
 * would now refuse; breaking it on the author's next click would destroy a working program
 * and blame the click. So a tightening that would sever a live connection is simply not
 * applied, and the connection stays permissive until the author disconnects it themselves —
 * at which point this runs again and the check lands.
 *
 * Loosening (`null`) is always safe and always applied.
 */
function setCheckWithoutBreakingWires(connection: Blockly.Connection | null, nextCheck: string | null): void {
  if (!connection) return;

  const next = nextCheck === null ? null : [nextCheck];
  if (sameCheck(connection.getCheck(), next)) return;

  if (next !== null && connection.isConnected()) {
    // Blockly's rule, `ConnectionChecker.doTypeChecks`: a `null` check on either end admits
    // everything, otherwise the two arrays must intersect.
    const otherCheck = connection.targetConnection ? connection.targetConnection.getCheck() : null;
    if (otherCheck && otherCheck.indexOf(nextCheck as string) === -1) return;
  }

  connection.setCheck(next);
}

/**
 * Keep one block's connection check in step with the port declaration it refers to.
 *
 * Registered with `setOnChange`, which is a workspace change listener bound to the block —
 * so it runs on every event, and (crucially) on **none** during load: `BlocklyWorkspace`
 * deserialises inside `Blockly.Events.disable()`, so a saved program is reconstructed with
 * the checks it was saved with and nothing is re-typed underneath it.
 */
function trackDeclaredType(
  block: Blockly.Block,
  defineBlockType: string,
  plug: 'input' | 'output',
  connectionOf: (block: Blockly.Block) => Blockly.Connection | null
): void {
  block.setOnChange(function (this: Blockly.Block) {
    if (!this.workspace || this.isInFlyout || this.disposed) return;
    // Mid-drag the connection set is in flux and the drop fires its own event.
    const workspace = this.workspace as Blockly.WorkspaceSvg;
    if (typeof workspace.isDragging === 'function' && workspace.isDragging()) return;

    const declared = declaredTypeOfPort(this, defineBlockType, this.getFieldValue('NAME'));
    setCheckWithoutBreakingWires(connectionOf(this), connectionCheckForDeclaredPort(declared, plug));
  });
}

/**
 * Initialize all Noodl custom blocks
 */
export function initNoodlBlocks() {
  // Input/Output blocks
  defineInputOutputBlocks();

  // Variable blocks
  defineVariableBlocks();

  // Object blocks (basic - will expand later)
  defineObjectBlocks();

  // Array blocks (basic - will expand later)
  defineArrayBlocks();

  // VFN-012 §1 — the app's declared config variables
  defineAppConfigBlocks();

  // VFN-012 §2/§3 — the libraries this app registered, and `window`
  defineBrowserBlocks();

  // FIX-004 §A — convert and log
  defineUtilityBlocks();

  // FIX-004 §C — objects as data
  defineObjectDataBlocks();
}

/**
 * Utility Blocks (FIX-004 §A)
 *
 * The two holes the user test found by walking into them: there is no way to turn text into a
 * number, and no way to see a value. Both are genuine absences in core Blockly rather than
 * discovery failures — the block registry ships no conversion block at all, and its only print
 * block generates `window.alert`, which is why this toolbox has always excluded it.
 */
function defineUtilityBlocks() {
  /**
   * `convert [number ▾] of ( )` — the missing `Number()`.
   *
   * The output check follows the mode, which is what makes the block worth having over a
   * coercion trick: wired into a maths socket in `text` mode, Blockly refuses the connection
   * and says so, instead of silently producing `"50"` from `"5" + 0`.
   */
  Blockly.Blocks['noodl_convert'] = {
    init: function (this: Blockly.Block) {
      const dropdown = new Blockly.FieldDropdown(convertModeOptions());
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('🔢 convert')
        .appendField(dropdown, 'MODE')
        .appendField('of');
      this.setOutput(true, convertModeCheck(DEFAULT_CONVERT_MODE));
      this.setColour(230);
      this.setTooltip(convertModeTooltip(DEFAULT_CONVERT_MODE));
      this.setHelpUrl('');

      /**
       * Keep the output check and the tooltip in step with the mode.
       *
       * `setOnChange` rather than a field validator, for the reason `trackDeclaredType` uses it:
       * `BlocklyWorkspace` deserialises inside `Blockly.Events.disable()`, so a saved program is
       * rebuilt with the check `init` gave it and nothing is re-typed underneath the author.
       * `setCheckWithoutBreakingWires` then refuses any change that would sever a live wire.
       */
      this.setOnChange(function (this: Blockly.Block) {
        if (!this.workspace || this.isInFlyout || this.disposed) return;
        const mode = this.getFieldValue('MODE');
        setCheckWithoutBreakingWires(this.outputConnection, convertModeCheck(mode));
        this.setTooltip(convertModeTooltip(mode));
      });
    }
  };

  /**
   * `log ( )` — a statement, and therefore hattable.
   *
   * 🔴 Registered in `hatMigration.ts`'s `HATTABLE_BLOCK_TYPES`. A statement block missing from
   * that list is never wrapped by migration or seeding and sits orphaned under no hat, which
   * `tests-unit/lgc-009/hat-migration.spec.ts` catches by instantiating every toolbox block in
   * real Blockly and comparing `previousConnection` against the list.
   *
   * `console` needs no runtime work, and **both halves of that are now driven** rather than read
   * off a file: the browser runtime compiles logic with a plain `new Function` in global scope
   * (printed in a live viewer, FIX-004 session 35), and a cloud function reaches Node's own
   * `console` because `nodegx-backend` runs `CloudRunner` **in-process** — measured end to end in
   * `nodegx-backend/tests/cloud-logic-builder-log.test.ts`.
   *
   * ⚠️ This comment used to credit the cloud half to `sandbox.isolate.js:26` installing
   * `global.console`. **That reason was stale and it misled FIX-004's task file into predicting a
   * `_noodl_api_call('log', …)` entry instead of stdout.** WF-007 deleted the dev-time
   * cloud-function-server and its sandbox (`noodl-viewer-cloud/webpack-configs/webpack.prod.js:1-6`),
   * and `_noodl_api_call` has no implementation in this repo at all — it was the external
   * `noodl-cloudservice`'s host global. Nothing here loads that bundle.
   *
   * 🔴 The consequence an author should know: a block's `console.log` is a **bare** one. Unlike the
   * `Log` node (`net.noodl.Log`), it is not levelled, carries no request id, never reaches the
   * execution record, and is **not redacted** — a provisioned secret logged from a block program
   * goes to stdout in the clear, which the suite above measures against a non-logging control.
   */
  Blockly.Blocks['noodl_log'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('VALUE').setCheck(null).appendField('🖨️ log');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      // Matches the Debug category's hue in `BlocklyToolbox.ts`, as every other block here
      // matches the category it is reached from.
      this.setColour(0);
      this.setTooltip('Prints a value to the console — in the preview, and in a cloud function.');
      this.setHelpUrl('');
    }
  };
}

/**
 * Input/Output Blocks
 */
function defineInputOutputBlocks() {
  /**
   * LGC-009 — the hat, and the only block in this file with a `next` and no `previous`.
   *
   * ## What it is for
   *
   * Before this, a Noodl block program had **no stated beginning**: 9 statement shapes, 6 value
   * shapes, zero hats, so a program was a free-floating stack and where it started was wherever
   * the author happened to drop the topmost block. Every other block language states it —
   * Scratch's *when green flag clicked*, MakeCode's *on start*. The hat is the token that makes
   * *"this code runs"* and *"this code is stranded"* different sentences, and without one the
   * distinction is not expressible, which is why `Blockly.Events.disableOrphans` — a predicate
   * whose whole meaning rests on it — disabled every program it was shown
   * (`FINDING-2026-08-12-disableOrphans-kills-every-program.md`).
   *
   * ## 🔴 What it does **not** do yet, stated here because the label reads as though it does
   *
   * The name in this field declares a signal input port (`detectIO` reads it) and marks where the
   * program starts. It does **not** gate execution: the node runs its whole `generatedCode` on
   * any signal, so a program with *two* hats runs both bodies whichever signal arrived. With one
   * hat — what the migration writes, and what a new program opens with — the label is literally
   * true; with two it over-promises.
   *
   * Making it true is a **one-line generator change and no runtime change at all**: the runtime
   * already passes `__triggerSignal__` as the eighth parameter of the compiled function, and its
   * own docstring says it is there *"so a program with several of them can branch on it"*. It is
   * deliberately not done here, because acceptance criterion 1 requires a hatted program to
   * generate byte-identically to today's hatless one. Filed as HAT-DISPATCH in
   * `NOTES-LGC-009.md`, with the casing trap that decides it.
   *
   * ## Shape
   *
   * `setNextStatement` only — no `setPreviousStatement`, no `setOutput`. `hat = 'cap'` is
   * Blockly's own opt-in for the rounded top (the same one `procedures_defnoreturn` uses); it is
   * a plain property on the block, so it costs nothing headless and reads at render time.
   */
  Blockly.Blocks[HAT_BLOCK_TYPE] = {
    init: function () {
      this.appendDummyInput()
        .appendField('▶ when')
        .appendField(new Blockly.FieldTextInput(DEFAULT_HAT_SIGNAL), 'NAME')
        .appendField('is received');
      this.setNextStatement(true, null);
      // Deliberately no `setPreviousStatement` and no `setOutput`: this is the block that
      // cannot be an orphan, which is the whole of its job.
      this.hat = 'cap';
      this.setColour(180);
      this.setTooltip(
        'The program starts here. Names a signal input on the node, and marks the blocks under it as the ones that run. Note: every hat in a program runs on every signal today — per-hat dispatch is not built yet.'
      );
      this.setHelpUrl('');
    }
  };

  // Define Input block - declares an input port
  Blockly.Blocks['noodl_define_input'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('📥 Define input')
        .appendField(new Blockly.FieldTextInput('myInput'), 'NAME')
        .appendField('type')
        .appendField(
          new Blockly.FieldDropdown([
            ['any', '*'],
            ['string', 'string'],
            ['number', 'number'],
            ['boolean', 'boolean'],
            ['object', 'object'],
            ['array', 'array']
          ]),
          'TYPE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip('Defines an input port that appears on the node');
      this.setHelpUrl('');
    }
  };

  // Get Input block - gets value from an input
  Blockly.Blocks['noodl_get_input'] = {
    init: function () {
      this.appendDummyInput().appendField('📥 get input').appendField(new Blockly.FieldTextInput('value'), 'NAME');
      // ⚠️ Stays `null`, and the tracker below is what keeps it that way *on purpose* rather
      // than by omission. `connectionCheckForDeclaredPort(…, 'input')` returns `null` for
      // every type because nothing between the wire and here converts anything — the reasons
      // are in its docstring, read in source. The seam is wired so that the day the runtime
      // coerces, the policy function is the only edit.
      this.setOutput(true, null);
      trackDeclaredType(this, 'noodl_define_input', 'input', (block) => block.outputConnection);
      this.setColour(230);
      this.setTooltip('Gets the value from an input port');
      this.setHelpUrl('');
    }
  };

  // Define Output block - declares an output port
  Blockly.Blocks['noodl_define_output'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('📤 Define output')
        .appendField(new Blockly.FieldTextInput('result'), 'NAME')
        .appendField('type')
        .appendField(
          new Blockly.FieldDropdown([
            ['any', '*'],
            ['string', 'string'],
            ['number', 'number'],
            ['boolean', 'boolean'],
            ['object', 'object'],
            ['array', 'array']
          ]),
          'TYPE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip('Defines an output port that appears on the node');
      this.setHelpUrl('');
    }
  };

  // Set Output block - sets value on an output
  Blockly.Blocks['noodl_set_output'] = {
    init: function () {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('📤 set output')
        .appendField(new Blockly.FieldTextInput('result'), 'NAME')
        .appendField('to');
      // The enforceable half of LGC-005. A `Define output` typed `number` makes this socket
      // refuse a `text` block, because both ends of that promise are inside this workspace.
      // Starts `null` so a saved program loads exactly as it was saved; the tracker tightens
      // it on the first event, and never over a live wire.
      trackDeclaredType(this, 'noodl_define_output', 'output', (block) => {
        const input = block.getInput('VALUE');
        return input ? input.connection : null;
      });
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip('Sets the value of an output port');
      this.setHelpUrl('');
    }
  };

  // Define Signal Input block
  Blockly.Blocks['noodl_define_signal_input'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('⚡ Define signal input')
        .appendField(new Blockly.FieldTextInput('trigger'), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(180);
      this.setTooltip('Defines a signal input that can trigger logic');
      this.setHelpUrl('');
    }
  };

  // Define Signal Output block
  Blockly.Blocks['noodl_define_signal_output'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('⚡ Define signal output')
        .appendField(new Blockly.FieldTextInput('done'), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(180);
      this.setTooltip('Defines a signal output that can trigger other nodes');
      this.setHelpUrl('');
    }
  };

  // Send Signal block
  Blockly.Blocks['noodl_send_signal'] = {
    init: function () {
      this.appendDummyInput().appendField('⚡ send signal').appendField(new Blockly.FieldTextInput('done'), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(180);
      this.setTooltip('Sends a signal to connected nodes');
      this.setHelpUrl('');
    }
  };
}

/**
 * Variable Blocks
 */
function defineVariableBlocks() {
  // Get Variable block
  Blockly.Blocks['noodl_get_variable'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('📖 get variable')
        .appendField(new Blockly.FieldTextInput('myVariable'), 'NAME');
      this.setOutput(true, null);
      this.setColour(330);
      this.setTooltip('Gets the value of a global Noodl variable');
      this.setHelpUrl('');
    }
  };

  // Set Variable block
  Blockly.Blocks['noodl_set_variable'] = {
    init: function () {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('✏️ set variable')
        .appendField(new Blockly.FieldTextInput('myVariable'), 'NAME')
        .appendField('to');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('Sets the value of a global Noodl variable');
      this.setHelpUrl('');
    }
  };
}

/**
 * Object Blocks (basic set - will expand in Phase E)
 */
function defineObjectBlocks() {
  // Get Object block
  Blockly.Blocks['noodl_get_object'] = {
    init: function () {
      this.appendValueInput('ID').setCheck(check('string')).appendField('📦 get object');
      this.setOutput(true, check('object'));
      this.setColour(20);
      this.setTooltip('Gets a Noodl Object by its ID');
      this.setHelpUrl('');
    }
  };

  // Get Object Property block
  Blockly.Blocks['noodl_get_object_property'] = {
    init: function () {
      this.appendValueInput('OBJECT')
        .setCheck(null)
        .appendField('📖 get')
        .appendField(new Blockly.FieldTextInput('name'), 'PROPERTY')
        .appendField('from object');
      this.setOutput(true, null);
      this.setColour(20);
      this.setTooltip('Gets a property value from an object');
      this.setHelpUrl('');
    }
  };

  // Set Object Property block
  Blockly.Blocks['noodl_set_object_property'] = {
    init: function () {
      this.appendValueInput('OBJECT')
        .setCheck(null)
        .appendField('✏️ set')
        .appendField(new Blockly.FieldTextInput('name'), 'PROPERTY')
        .appendField('on object');
      this.appendValueInput('VALUE').setCheck(null).appendField('to');
      this.setInputsInline(false);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('Sets a property value on an object');
      this.setHelpUrl('');
    }
  };
}

/**
 * Objects as data (FIX-004 §C)
 *
 * The blocks above reach into a Noodl Object at a name typed into the block. These are the
 * rest of the vocabulary the Function node has and the block language did not: making an
 * object, computing a key, asking what keys there are, and crossing the JSON boundary. See
 * `objectData.ts` for every expression they generate and for the `in`-is-inverted measurement
 * that decides one of them.
 *
 * ## Two shared decisions, made once here
 *
 * **The object socket takes anything (`null`).** It could plausibly demand `Object`, which
 * would refuse `get property of ( "hello" )`. It does not, because the blocks in this toolbox
 * that *produce* object-shaped values mostly declare no check at all — `get input`, `app
 * config`, `library`, `window`, `read JSON` — so an `Object` check would refuse real programs
 * far more often than it would catch a mistake, while `Array` is a legitimate target for every
 * operation here. It also matches the existing `noodl_get_object_property` pair, which is what
 * an author will read these as twins of.
 *
 * **The key socket takes `String` or `Number`.** Those are the two things JavaScript accepts
 * as a property key without surprising anybody, and stating both is what lets a key come out
 * of `the property names of ( )` (strings) or out of a counted loop (numbers).
 */
function defineObjectDataBlocks() {
  /** `{}` — a new, empty object to fill in. Generated parenthesised; see `NEW_OBJECT_EXPRESSION`. */
  Blockly.Blocks['noodl_new_object'] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField('🆕 empty object');
      this.setOutput(true, check('object'));
      this.setColour(20);
      this.setTooltip('A new, empty object. Add properties to it with "set property".');
      this.setHelpUrl('');
    }
  };

  /**
   * `get property ( ) of object ( )` — the computed-key twin of `noodl_get_object_property`.
   *
   * A separate block rather than a socket added to the existing one: the existing block holds
   * its key in a `FieldTextInput`, and turning that field into a value input would change the
   * shape of every saved program that uses it. Two blocks cost a toolbox row; a shape change
   * costs a migration.
   */
  Blockly.Blocks['noodl_get_object_property_expr'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('KEY').setCheck(['String', 'Number']).appendField('📖 get property');
      this.appendValueInput('OBJECT').setCheck(null).appendField('of object');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(20);
      this.setTooltip('Reads a property whose name is worked out while the program runs.');
      this.setHelpUrl('');
    }
  };

  /**
   * `set property ( ) of object ( ) to ( )` — the computed-key twin of
   * `noodl_set_object_property`.
   *
   * 🔴 A statement, so it is on `hatMigration.ts`'s `HATTABLE_BLOCK_TYPES`. A statement block
   * missing from that list is never wrapped by migration or seeding and sits orphaned under no
   * hat — the trap FIX-004 §A already paid for once with `noodl_log`.
   */
  Blockly.Blocks['noodl_set_object_property_expr'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('KEY').setCheck(['String', 'Number']).appendField('✏️ set property');
      this.appendValueInput('OBJECT').setCheck(null).appendField('of object');
      this.appendValueInput('VALUE').setCheck(null).appendField('to');
      this.setInputsInline(false);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('Writes a property whose name is worked out while the program runs.');
      this.setHelpUrl('');
    }
  };

  /**
   * `[the property names ▾] of object ( )` — `Object.keys` / `Object.values`.
   *
   * The output check is `Array` in both modes, which is the point of the block: `controls_forEach`
   * requires `Array`, so this is the piece that makes an object iterable at all. The mode only
   * changes what is in the list, never its type, so unlike `noodl_convert` there is nothing to
   * re-check when the dropdown moves.
   */
  Blockly.Blocks['noodl_object_members'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('OBJECT')
        .setCheck(null)
        .appendField('🗝️')
        .appendField(new Blockly.FieldDropdown(objectMembersOptions()), 'MODE')
        .appendField('of object');
      this.setOutput(true, check('array'));
      this.setColour(20);
      this.setTooltip(objectMembersTooltip(DEFAULT_OBJECT_MEMBERS_MODE));
      this.setOnChange(function (this: Blockly.Block) {
        if (!this.workspace || this.isInFlyout || this.disposed) return;
        this.setTooltip(objectMembersTooltip(this.getFieldValue('MODE')));
      });
      this.setHelpUrl('');
    }
  };

  /** `object ( ) has property ( )` — 🔴 `hasOwnProperty.call`, not `in`. See `objectData.ts`. */
  Blockly.Blocks['noodl_object_has_property'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('OBJECT').setCheck(null).appendField('❓ object');
      this.appendValueInput('KEY').setCheck(['String', 'Number']).appendField('has property');
      this.setInputsInline(true);
      this.setOutput(true, check('boolean'));
      this.setColour(20);
      this.setTooltip('True if the object carries a property with that name.');
      this.setHelpUrl('');
    }
  };

  /**
   * `read JSON ( )` — the output check is **`null`**, and that is the honest value.
   *
   * Every other block in this file whose result type is knowable declares it. This one's is
   * not: `JSON.parse` returns an object, a list, a number, a string, a boolean or null
   * depending on the text it is handed, and picking `Object` would refuse the perfectly
   * ordinary case of a JSON array.
   */
  Blockly.Blocks['noodl_json_parse'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('TEXT').setCheck(check('string')).appendField('📥 read JSON');
      this.setOutput(true, null);
      this.setColour(20);
      this.setTooltip(JSON_PARSE_TOOLTIP);
      this.setHelpUrl('');
    }
  };

  /** `JSON text of ( )`. ⚠️ An App Object carries its `id` into the text — `Model.toJSON`. */
  Blockly.Blocks['noodl_json_stringify'] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput('VALUE').setCheck(null).appendField('📤 JSON text of');
      this.setOutput(true, check('string'));
      this.setColour(20);
      this.setTooltip(JSON_STRINGIFY_TOOLTIP);
      this.setHelpUrl('');
    }
  };
}

/**
 * Array Blocks (basic set - will expand in Phase E)
 */
function defineArrayBlocks() {
  // Get Array block
  Blockly.Blocks['noodl_get_array'] = {
    init: function () {
      this.appendDummyInput().appendField('📋 get array').appendField(new Blockly.FieldTextInput('myArray'), 'NAME');
      this.setOutput(true, check('array'));
      this.setColour(260);
      this.setTooltip('Gets a Noodl Array by name');
      this.setHelpUrl('');
    }
  };

  // Array Length block
  Blockly.Blocks['noodl_array_length'] = {
    init: function () {
      this.appendValueInput('ARRAY').setCheck(check('array')).appendField('🔢 length of array');
      this.setOutput(true, check('number'));
      this.setColour(260);
      this.setTooltip('Gets the number of items in an array');
      this.setHelpUrl('');
    }
  };

  // Array Add block
  Blockly.Blocks['noodl_array_add'] = {
    init: function () {
      this.appendValueInput('ITEM').setCheck(null).appendField('➕ add');
      this.appendValueInput('ARRAY').setCheck(check('array')).appendField('to array');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip('Adds an item to the end of an array');
      this.setHelpUrl('');
    }
  };
}

/**
 * The key field on the App Config block (VFN-012).
 *
 * ## Why this is a dropdown at all, when every other name field here is free text
 *
 * The rest of this language uses `FieldTextInput` because Noodl variables, objects and arrays
 * are *created by being used* — there is no declared set to choose from, so a dropdown would
 * have to be over the empty set. App config variables are declared, so the valid keys are
 * known, finite and typed, and a dropdown turns *"did I spell it right"* into a non-question.
 *
 * ## 🔴 Why it is a subclass and not `new Blockly.FieldDropdown(…)`
 *
 * A stock dropdown **rewrites a value it does not recognise to the first option in its list**.
 * Measured in Blockly 12.3.1: save a block on `maxItems`, delete `maxItems` from app settings,
 * reopen — the field comes back holding whatever key happens to sort first, the console carries
 * one line saying *"Cannot set the dropdown's value to an unavailable option"*, and the program
 * now reads a different variable. That is a program changed by the act of opening it, and it is
 * exactly what VFN-012 criterion 2 forbids.
 *
 * Two overrides fix it and nothing else has to change:
 *
 * - `doClassValidation_` accepts any string, so the stored value is always the key the author
 *   chose — the field is a *picker*, not the authority on which keys exist.
 * - `getText_` renders an undeclared key **as itself, marked** (`⚠ oldKey`), so the block says
 *   what is wrong rather than quietly reading `undefined`.
 *
 * ⚠️ The mark is computed at render time from the provider, and Blockly re-renders a field on
 * value change — not on app settings changing underneath it. A block already on the canvas keeps
 * its mark until it is touched or the editor is reopened. Stale in the harmless direction: the
 * *stored key* is never wrong, only the warning glyph is late.
 */
class ConfigKeyField extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(() => appConfigKeyOptions(appConfigVariables()) as Blockly.MenuOption[]);
    if (typeof value === 'string') {
      this.setValue(value);
    }
  }

  /** Any string is a legal key — including one app settings no longer declares. */
  protected doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null;
  }

  /** An undeclared key reads as itself, marked. Never as another key. */
  protected getText_(): string | null {
    return appConfigKeyDisplay(appConfigVariables(), this.getValue() || '');
  }
}

/**
 * App Config Blocks (VFN-012)
 *
 * One block, and one is the whole feature: `Noodl.Config` is immutable at runtime, so there is
 * no honest setter to offer. See `appConfig.ts` for the reasoning and for everything in this
 * feature that can be graded without Blockly.
 */
function defineAppConfigBlocks() {
  Blockly.Blocks[APP_CONFIG_BLOCK_TYPE] = {
    init: function () {
      const variables = appConfigVariables();

      this.appendDummyInput()
        .appendField('⚙️ app config')
        .appendField(new ConfigKeyField(defaultConfigKey(variables)), 'KEY');
      this.setOutput(true, null);
      this.setColour(Number(APP_CONFIG_HUE));
      // A function, so the hover text follows the key the block currently holds — including
      // "this key is gone", which is the one a builder most needs to read.
      this.setTooltip(() => appConfigTooltip(appConfigVariables(), this.getFieldValue('KEY') || ''));
      this.setHelpUrl('');
    }
  };
}

/**
 * The library-global dropdown — `ConfigKeyField`'s twin, for the same defect.
 *
 * Blockly 12.3.1's stock `FieldDropdown` rewrites a value it does not recognise to the first
 * option in its list (measured in `app-config-block.spec.ts`, which builds one and watches it).
 * A block reading `window.PocketBase` would therefore come back reading `window.Something Else`
 * the moment that library was removed — or, far worse and unique to this half, **the moment the
 * project was opened**, because the library list is read off disk asynchronously and is empty
 * for the first tick of every session.
 *
 * That second case is why this field reads a *snapshot* and not an array:
 *
 * - `doClassValidation_` accepts any string, so the stored global is always the one the author
 *   chose — the field is a picker, not the authority on which libraries exist.
 * - `getText_` marks an unregistered global **only against a completed scan**. While the read is
 *   in flight the global renders plainly, because "I have not looked yet" is not evidence of
 *   absence. See `libraryGlobalDisplay`.
 */
class LibraryGlobalField extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(() => libraryGlobalOptions(registeredLibrariesSnapshot()) as Blockly.MenuOption[]);
    if (typeof value === 'string') {
      this.setValue(value);
    }
  }

  /** Any string is a legal global — including one this project no longer registers. */
  protected doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null;
  }

  /** An unregistered global reads as itself, marked. Never as another library. */
  protected getText_(): string | null {
    return libraryGlobalDisplay(registeredLibrariesSnapshot(), this.getValue() || '');
  }
}

/**
 * Library and browser blocks (VFN-012 §2 and §3)
 *
 * Two value blocks, one category. `window.<global>` for a library this app registered, and a bare
 * `window` with a property path for everything else. See `appLibraries.ts` and `windowAccess.ts`
 * for the reasoning and for everything in this feature that can be graded without Blockly.
 */
function defineBrowserBlocks() {
  Blockly.Blocks[LIBRARY_GLOBAL_BLOCK_TYPE] = {
    init: function () {
      this.appendDummyInput()
        .appendField('📦 library')
        .appendField(new LibraryGlobalField(defaultLibraryGlobal(registeredLibrariesSnapshot())), 'GLOBAL');
      this.setOutput(true, null);
      this.setColour(Number(BROWSER_HUE));
      // A function, so the hover text follows the global the block currently holds — including
      // "this library is gone" and "we have not read them yet", which are different sentences.
      this.setTooltip(() => libraryTooltip(registeredLibrariesSnapshot(), this.getFieldValue('GLOBAL') || ''));
      this.setHelpUrl('');
    }
  };

  Blockly.Blocks[WINDOW_BLOCK_TYPE] = {
    init: function () {
      // A free text field, like every other name field in this language — and here it is the
      // whole design. There is no list of browser globals to pick from that would not be a claim
      // about what exists; see the module note in `windowAccess.ts`.
      this.appendDummyInput()
        .appendField('🌐 window.')
        .appendField(new Blockly.FieldTextInput(DEFAULT_WINDOW_PATH), 'PATH');
      this.setOutput(true, null);
      this.setColour(Number(BROWSER_HUE));
      this.setTooltip(() => windowTooltip(this.getFieldValue('PATH') || ''));
      this.setHelpUrl('');
    }
  };
}
