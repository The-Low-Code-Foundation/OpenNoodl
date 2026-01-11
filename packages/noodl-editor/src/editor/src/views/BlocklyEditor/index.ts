/**
 * BlocklyEditor Module
 *
 * Entry point for Blockly integration in Noodl.
 * Exports components, blocks, and generators for visual logic building.
 *
 * @module BlocklyEditor
 */

import { initNoodlBlocks } from './NoodlBlocks';
import { initNoodlGenerators } from './NoodlGenerators';

// Main component
export { BlocklyWorkspace } from './BlocklyWorkspace';
export type { BlocklyWorkspaceProps } from './BlocklyWorkspace';

// Block definitions and generators
export { initNoodlBlocks } from './NoodlBlocks';
export { initNoodlGenerators, generateCode } from './NoodlGenerators';

/**
 * Initialize all Noodl Blockly extensions
 * Call this once at app startup before using Blockly components
 */
export function initBlocklyIntegration() {
  console.log('🔧 [Blockly] Initializing Noodl Blockly integration');

  // Initialize custom blocks
  initNoodlBlocks();

  // Initialize code generators
  initNoodlGenerators();

  console.log('✅ [Blockly] Integration initialized');
}
