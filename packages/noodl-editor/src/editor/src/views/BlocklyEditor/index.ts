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
  ORPHANED_BLOCK_DISABLED_REASON,
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

// LGC-004 — the interface rails. The model half is import-free of the DOM (Blockly and the
// runtime's `detectInterface` only), so `tests-unit/lgc-004/` grades it headlessly; the overlay
// is DOM and a stylesheet and is exported for the workspace component.
//
// ⚠️ `railModelFromWorkspaceJson` is the one anything outside the block editor should reach for:
// it answers from the node's saved `workspace` parameter, so it works for a Visual Function that
// has been placed on the canvas but never opened. Nothing here is a port *store* — see the file.
export {
  ANY_TYPE_LABEL,
  GET_INPUT_BLOCK,
  SET_OUTPUT_BLOCK,
  SIGNAL_TYPE_LABEL,
  dragBlockJsonForRow,
  railModelForWorkspace,
  railModelFromWorkspaceJson,
  unusedOutputName
} from './interfaceRails';
export type { RailModel, RailRow } from './interfaceRails';
export { attachInterfaceRails } from './InterfaceRailsOverlay';
export type { InterfaceRailsHandle, InterfaceRailsOptions } from './InterfaceRailsOverlay';
// LGC-003 — the pushed probe. `BlockProbes` and `BlockValueTrace` are import-free (Blockly
// only, and the second not even that), so `tests-unit/lgc-003/` grades the instrumentation,
// the identity property, the precedence safety and the map→hollow logic headlessly. The three
// that cannot be are the three that must not be: `BlockValueBadges` (SVG and the canvas
// theme), `BlockTraceClient` (the socket) and `BlockValueController` (both, plus the DOM).
export {
  PROBE_PARAMETER_NAMES,
  PROBE_STATEMENT_FN,
  PROBE_STATEMENT_PREFIX,
  PROBE_VALUE_FN,
  probeExpression,
  withBlockProbes
} from './BlockProbes';
export type { ProbedGeneration } from './BlockProbes';
export {
  BlockRunHistory,
  FramePaintScheduler,
  RUN_HISTORY_LIMIT,
  STATUS_COPY,
  badgeText,
  markFor,
  programHasProbes,
  stripReasonFor
} from './BlockValueTrace';
export type {
  BlockMark,
  BlockMarkState,
  BlockRunFrame,
  BlockStripReason,
  BlockValueEntry,
  StripReasonInput
} from './BlockValueTrace';
export { BlockValueBadgeLayer, truncateBadge } from './BlockValueBadges';
export { attachBlockTrace } from './BlockTraceClient';
export type { BlockTraceHandle, BlockTraceStatus } from './BlockTraceClient';
export { attachBlockValues } from './BlockValueController';
export type { BlockValueHandle, BlockValueOptions } from './BlockValueController';

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

// LGC-009 — the hat. The block itself is registered by `initNoodlBlocks`; the type id and the
// default signal name live in `@noodl/runtime` (the viewer window has to know them too), and the
// migration below is a plain JSON transform with no Blockly in it, so it is safe for
// `CanvasTabsContext` — which is in the main bundle — to import.
export { HATTABLE_BLOCK_TYPES, ensureHats, ensureHatsInJson, isHattableBlockType } from './hatMigration';
export type { EnsureHatsOptions, EnsureHatsResult } from './hatMigration';

// Toolbox and language
export { buildToolbox, DEFAULT_TOOLBOX_LABELS } from './BlocklyToolbox';
export type { ToolboxLabels } from './BlocklyToolbox';
export { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES, applyLanguage, currentLanguageCode } from './BlocklyLocale';
