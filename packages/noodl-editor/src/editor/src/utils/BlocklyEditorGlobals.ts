/**
 * Blockly Editor Globals
 *
 * Exposes Blockly-related utilities to the global scope for use by runtime nodes
 */

import { generateCode } from '../views/BlocklyEditor/NoodlGenerators';
import { detectIO } from './IODetector';

// Extend window interface
declare global {
  interface Window {
    NoodlEditor?: {
      detectIO?: typeof detectIO;
      generateBlocklyCode?: typeof generateCode;
    };
  }
}

/**
 * Initialize Blockly editor globals
 * This makes IODetector and code generation available to runtime nodes
 */
export function initBlocklyEditorGlobals() {
  // Create NoodlEditor namespace if it doesn't exist
  if (typeof window !== 'undefined') {
    if (!window.NoodlEditor) {
      window.NoodlEditor = {};
    }

    // Expose IODetector
    window.NoodlEditor.detectIO = detectIO;

    // Expose code generator
    window.NoodlEditor.generateBlocklyCode = generateCode;

    console.log('✅ [Blockly] Editor globals initialized');
  }
}

// Auto-initialize when module loads
initBlocklyEditorGlobals();
