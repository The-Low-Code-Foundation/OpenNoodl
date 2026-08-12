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

import { blocklyCheckForNoodlType, connectionCheckForDeclaredPort, PERMISSIVE_NOODL_TYPE } from './NoodlTypes';

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
