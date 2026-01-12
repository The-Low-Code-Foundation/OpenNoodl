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

/**
 * Initialize all Noodl code generators
 */
export function initNoodlGenerators() {
  console.log('🔧 [Blockly] Initializing Noodl code generators');

  // Input/Output generators
  initInputOutputGenerators();

  // Variable generators
  initVariableGenerators();

  // Object generators
  initObjectGenerators();

  // Array generators
  initArrayGenerators();

  console.log('✅ [Blockly] Noodl generators initialized');
}

/**
 * Input/Output Generators
 */
function initInputOutputGenerators() {
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

  // Send Signal - generates: this.sendSignalOnOutput("name");
  javascriptGenerator.forBlock['noodl_send_signal'] = function (block) {
    const name = block.getFieldValue('NAME');
    return `this.sendSignalOnOutput("${name}");\n`;
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
 * Generate complete JavaScript code from workspace
 *
 * @param workspace - The Blockly workspace
 * @returns Generated JavaScript code
 */
export function generateCode(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace);
}
