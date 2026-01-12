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
  console.log('🔍 [BlocklyGlobals] initBlocklyEditorGlobals called');
  console.log('🔍 [BlocklyGlobals] window undefined?', typeof window === 'undefined');

  // Create NoodlEditor namespace if it doesn't exist
  if (typeof window !== 'undefined') {
    console.log('🔍 [BlocklyGlobals] window.NoodlEditor before:', window.NoodlEditor);

    if (!window.NoodlEditor) {
      window.NoodlEditor = {};
      console.log('🔍 [BlocklyGlobals] Created new window.NoodlEditor');
    }

    // Expose IODetector
    window.NoodlEditor.detectIO = detectIO;
    console.log('🔍 [BlocklyGlobals] Assigned detectIO:', typeof window.NoodlEditor.detectIO);

    // Expose code generator
    window.NoodlEditor.generateBlocklyCode = generateCode;
    console.log('🔍 [BlocklyGlobals] Assigned generateBlocklyCode:', typeof window.NoodlEditor.generateBlocklyCode);

    console.log('✅ [Blockly] Editor globals initialized');
    console.log('🔍 [BlocklyGlobals] window.NoodlEditor after:', window.NoodlEditor);
  }
}

// Auto-initialize when module loads
initBlocklyEditorGlobals();
