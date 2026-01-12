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

/**
 * Initialize all Noodl custom blocks
 */
export function initNoodlBlocks() {
  console.log('🔧 [Blockly] Initializing Noodl custom blocks');

  // Input/Output blocks
  defineInputOutputBlocks();

  // Variable blocks
  defineVariableBlocks();

  // Object blocks (basic - will expand later)
  defineObjectBlocks();

  // Array blocks (basic - will expand later)
  defineArrayBlocks();

  console.log('✅ [Blockly] Noodl blocks initialized');
}

/**
 * Input/Output Blocks
 */
function defineInputOutputBlocks() {
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
      this.setOutput(true, null);
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
      this.appendValueInput('ID').setCheck('String').appendField('📦 get object');
      this.setOutput(true, 'Object');
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
      this.setOutput(true, 'Array');
      this.setColour(260);
      this.setTooltip('Gets a Noodl Array by name');
      this.setHelpUrl('');
    }
  };

  // Array Length block
  Blockly.Blocks['noodl_array_length'] = {
    init: function () {
      this.appendValueInput('ARRAY').setCheck('Array').appendField('🔢 length of array');
      this.setOutput(true, 'Number');
      this.setColour(260);
      this.setTooltip('Gets the number of items in an array');
      this.setHelpUrl('');
    }
  };

  // Array Add block
  Blockly.Blocks['noodl_array_add'] = {
    init: function () {
      this.appendValueInput('ITEM').setCheck(null).appendField('➕ add');
      this.appendValueInput('ARRAY').setCheck('Array').appendField('to array');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip('Adds an item to the end of an array');
      this.setHelpUrl('');
    }
  };
}
