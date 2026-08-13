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
// VFN-014 — the same program, generated with the probe wrapper simply not applied, plus a
// marker naming each inlined saved block. A display seam: it never writes, and
// `tests-unit/vfn-014/` holds the stored program byte-identical across a render.
export { renderReadableCode, renderReadableCodeFromJson, withBlockOrigins } from './readableCode';
export type { ReadableCodeResult } from './readableCode';
export {
  BlockRunHistory,
  FramePaintScheduler,
  RUN_HISTORY_LIMIT,
  STATUS_COPY,
  badgeText,
  benchHint,
  benchHintApplies,
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
export { BADGE_TOKENS, BlockValueBadgeLayer, badgeBoxWidth, truncateBadge } from './BlockValueBadges';
// VFN-013 — where a badge goes when its block is inside another block. Pure arithmetic over
// rectangles (no DOM, no Blockly), so `tests-unit/vfn-013/` grades the placement headlessly and
// against a negative control built from the anchor it replaces.
export {
  BADGE_GUTTER,
  BADGE_ROW_GAP,
  MAX_ROWS_ABOVE,
  MAX_ROWS_BELOW,
  isNested,
  layoutBadges,
  legacyBadgeAnchor,
  nestingDepth,
  rectsOverlap
} from './badgeLayout';
export type { BadgePlacement, BadgeRequest, BlockBox, Rect as BadgeRect } from './badgeLayout';
export { attachBlockTrace } from './BlockTraceClient';
export type { BlockTraceHandle, BlockTraceStatus } from './BlockTraceClient';
export { attachBlockValues } from './BlockValueController';
export type { BlockValueHandle, BlockValueOptions } from './BlockValueController';

// VFN-011 — the bench. Three of the four files are import-free of the DOM and of Blockly, so
// `tests-unit/vfn-011/` grades the runner against the runtime's own compile path (the drift gate),
// the sandbox reading, and the two standing constraints — that the bench enumerates no ports, and
// that pressing Run writes nothing to the program. The fourth, the cells and the ▶ on the rails,
// lives in `InterfaceRailsOverlay` because it is DOM.
//
// ⚠️ `BenchRunner` is a **second execution context**. Read its module note before extending it: the
// stubs are stated in the UI, and the agreement with the runtime is held by a gate rather than by
// this comment.
export {
  LOGIC_BUILDER_PARAMETERS,
  buildSandboxNoodl,
  compileBenchProgram,
  runOnBench
} from './BenchRunner';
export type { BenchRunRequest, BenchRunResult, CompiledBenchProgram, SandboxNoodl } from './BenchRunner';
export {
  SANDBOX_NOTE,
  benchInputRows,
  benchInputsFor,
  benchOutputRows,
  benchRunNote,
  benchTriggers,
  coerceSandboxValue
} from './benchModel';
export type { BenchInputRow, BenchOutputRow, SandboxText } from './benchModel';
export { BenchController, DEFAULT_BENCH_TRIGGER } from './BenchController';
export type { BenchControllerOptions, BenchLastRun, BenchSurface } from './BenchController';

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

// VFN-009 — the library in the project: where a saved block is used, what an edit to it changes,
// and every sentence the *Saved blocks* section says. All three are pure and are reached from the
// plain-Node runner; `MyBlocksProjectScan` and `MyBlocksLibrary` are the two halves that read the
// project and are, like `MyBlocksShelves`, deliberately not.
export {
  LOGIC_BUILDER_NODE_TYPE,
  WORKSPACE_PARAMETER,
  definitionUsage,
  definitionUsageMap,
  distinctSites,
  parseWorkspaceParameter,
  referencingNodeIds,
  scanNodeUsage
} from './myblocks/usage';
export type { DefinitionUsage, ProjectScan, ScannedComponent, ScannedNode, UsageSite } from './myblocks/usage';
export { definitionChangeFor, signatureOf } from './myblocks/definitionChange';
export type { DefinitionChange } from './myblocks/definitionChange';
export {
  MY_BLOCKS_GLYPH,
  SHELF_LABEL,
  SHELF_NOTE,
  UNPROVABLE_CLAIM,
  describeDeleteRefusal,
  describeDetachOffer,
  describeDetachResult,
  describeParameterChange,
  describePropagation,
  describeRegeneration,
  describeShapeChange,
  describeUsage,
  describeUsageShort,
  siteLine,
  unprovableClaimIn,
  usageLines
} from './myblocks/libraryIntent';
export { findNodeById, scanProject } from './MyBlocksProjectScan';
export {
  detachAndRemove,
  duplicateDefinition,
  exportDefinition,
  openDefinitionTab,
  removeDefinition,
  renameDefinition,
  saveDefinitionBlocks,
  savedBlockRows,
  usageNow
} from './MyBlocksLibrary';
export type { DetachResult, SavedBlockRow } from './MyBlocksLibrary';

// LGC-009 — the hat. The block itself is registered by `initNoodlBlocks`; the type id and the
// default signal name live in `@noodl/runtime` (the viewer window has to know them too), and the
// migration below is a plain JSON transform with no Blockly in it, so it is safe for
// `CanvasTabsContext` — which is in the main bundle — to import.
export { HATTABLE_BLOCK_TYPES, ensureHats, ensureHatsInJson, isHattableBlockType } from './hatMigration';
export type { EnsureHatsOptions, EnsureHatsResult } from './hatMigration';

// VFN-012 — the app's own config variables as blocks. Pure: no Blockly, no editor singletons,
// so the projection from `project.json` into the toolbox category is gradeable in plain Node.
export {
  appConfigFlyout,
  appConfigFlyoutContents,
  appConfigKeyDisplay,
  appConfigKeyOptions,
  appConfigReadExpression,
  appConfigTooltip,
  appConfigVariables,
  hasAppConfigEmptyState,
  normalizeConfigVariables,
  resetConfigVariablesProvider,
  setConfigVariablesProvider,
  APP_CONFIG_BLOCK_TYPE,
  APP_CONFIG_CATEGORY,
  APP_CONFIG_SETTINGS_BUTTON,
  APP_CONFIG_SETTINGS_PATH
} from './appConfig';
export type { AppConfigFlyoutItem, AppConfigKeyOption, ConfigVariablesProvider } from './appConfig';

// VFN-012 §2 — the libraries this app registered. Pure, and asynchronous at the edge: the
// snapshot is tri-state because `noodl_modules` is read off disk and "not read yet" is not the
// same answer as "there are none".
export {
  browserFlyout,
  browserFlyoutContents,
  defaultLibraryGlobal,
  hasLibrariesEmptyState,
  hasLibrariesLoadingState,
  hasLibrariesUnavailableState,
  hasWindowBlock,
  isRegisteredGlobal,
  librariesIn,
  libraryGlobalDisplay,
  libraryGlobalOptions,
  libraryReadExpression,
  libraryRuntimeNote,
  libraryTooltip,
  normalizeRegisteredLibraries,
  reachableLibraries,
  refreshRegisteredLibraries,
  registeredLibrariesSnapshot,
  resetRegisteredLibraries,
  setRegisteredLibrariesLoader,
  unreachableLibraries,
  BROWSER_CATEGORY,
  BROWSER_HUE,
  LIBRARIES_SETTINGS_BUTTON,
  LIBRARIES_SETTINGS_PATH,
  LIBRARY_GLOBAL_BLOCK_TYPE
} from './appLibraries';
export type {
  BrowserFlyoutItem,
  LibraryGlobalOption,
  RegisteredLibrariesLoader,
  RegisteredLibrariesSnapshot
} from './appLibraries';

// VFN-012 §3 — `window`, and the path grammar its one text field speaks.
export {
  parseWindowPath,
  windowPathDisplay,
  windowPathExpression,
  windowTooltip,
  DEFAULT_WINDOW_PATH,
  WINDOW_BLOCK_TYPE,
  WINDOW_CLOUD_WARNING
} from './windowAccess';
export type { WindowPathSegment } from './windowAccess';

// Toolbox and language
export { buildToolbox, DEFAULT_TOOLBOX_LABELS } from './BlocklyToolbox';
export type { ToolboxLabels } from './BlocklyToolbox';
export { BLOCK_LANGUAGE_SETTINGS_KEY, SUPPORTED_LANGUAGES, applyLanguage, currentLanguageCode } from './BlocklyLocale';
