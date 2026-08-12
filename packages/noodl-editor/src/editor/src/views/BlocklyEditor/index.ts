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

// LGC-002 — "Do It". The offer rule and the fragment generator are import-free (Blockly only)
// so `tests-unit/lgc-002/` grades them headlessly; the controller and the balloon layer are
// not, and are exported for the workspace component and for LGC-003, which extends the same
// probe channel from pull to push.
export {
  DECLARATION_BLOCK_TYPES,
  WRITING_BLOCK_TYPES,
  answerForReply,
  classifyBlockForDoIt,
  generateFragmentForBlock,
  invalidatesBalloons,
  wrapPreview
} from './DoIt';
export type { BlockFragmentReply, DoItAnswer, DoItOffer, GeneratedFragment } from './DoIt';
export { DoItBalloonLayer } from './DoItBalloons';
export type { BalloonContent, BalloonState } from './DoItBalloons';
export { attachDoIt, registerDoItMenuItem } from './DoItController';
export type { DoItHandle } from './DoItController';
export { requestBlockValue } from './DoItProbeClient';

// Block definitions and generators
export { initNoodlBlocks } from './NoodlBlocks';
export { initNoodlGenerators, generateCode } from './NoodlGenerators';
export { initBlocklyIntegration } from './initialize';

// My Blocks (LGC-007): a saved group of blocks, reusable in any Visual Function.
// The rules — format, store, cycle guard, shape inference, inliner — are in `myblocks/`
// and import nothing, not even Blockly. The two files below are the Blockly and editor
// halves and are the only ones that cannot be reached from a plain-Node runner.
export {
  bodyFromBlocks,
  callBlockJson,
  generateWithMyBlocks,
  initMyBlocks,
  myBlocksFlyout,
  previewSignature,
  MY_BLOCKS_CATEGORY
} from './MyBlocksBlocks';
export { myBlocksStore, PROJECT_LIBRARY_SETTING, USER_LIBRARY_SETTING } from './MyBlocksShelves';
export { MyBlocksStore, MyBlocksInUseError, InMemoryShelf } from './myblocks/store';
export { MyBlocksCycleError, MyBlocksMissingDefinitionError } from './myblocks/cycles';
export { MyBlocksBudgetError, MyBlocksShapeError, detachDefinition, expandWorkspace } from './myblocks/expand';
export { inferSignature } from './myblocks/shape';
export { MY_BLOCKS_FORMAT_VERSION, validateDefinition, validateLibrary } from './myblocks/format';
export type { MyBlockDefinition, MyBlockParam, MyBlocksLibrary, MyBlockShape } from './myblocks/format';
export type { MyBlocksScope, MyBlocksShelf } from './myblocks/store';

// Toolbox and language
export { buildToolbox, DEFAULT_TOOLBOX_LABELS } from './BlocklyToolbox';
export type { ToolboxLabels } from './BlocklyToolbox';
export { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES, applyLanguage, currentLanguageCode } from './BlocklyLocale';
