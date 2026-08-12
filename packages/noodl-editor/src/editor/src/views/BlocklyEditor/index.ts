/**
 * BlocklyEditor Module
 *
 * Entry point for the Logic Builder's block editor: the workspace component, the Noodl block
 * set and its code generators.
 *
 * Port detection deliberately does NOT live here. It is in `@noodl/runtime`
 * (`logic-builder-io`), because dynamic ports are published from the viewer window, which
 * cannot reach editor-window code — see dev-docs/reference/LEARNINGS-BLOCKLY.md §1.
 *
 * @module BlocklyEditor
 */

// Main component
export { BlocklyWorkspace } from './BlocklyWorkspace';
export type { BlocklyWorkspaceProps } from './BlocklyWorkspace';

// The Noodl port type ⇄ Blockly connection check map (LGC-005). Import-free by design, so it
// is safe for anything to reach — including the plain-Node test runner.
export {
  BLOCKLY_CHECK_TO_NOODL_TYPE,
  NOODL_TYPE_TO_BLOCKLY_CHECK,
  PERMISSIVE_NOODL_TYPE,
  blocklyCheckForNoodlType,
  connectionCheckForDeclaredPort,
  isSignalType,
  noodlTypeForBlocklyCheck
} from './NoodlTypes';

// Block definitions and generators
export { initNoodlBlocks } from './NoodlBlocks';
export { initNoodlGenerators, generateCode } from './NoodlGenerators';
export { initBlocklyIntegration } from './initialize';

// Toolbox and language
export { buildToolbox, DEFAULT_TOOLBOX_LABELS } from './BlocklyToolbox';
export type { ToolboxLabels } from './BlocklyToolbox';
export { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES, applyLanguage, currentLanguageCode } from './BlocklyLocale';
