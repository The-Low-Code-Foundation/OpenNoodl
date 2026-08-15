/**
 * JavaScriptEditor Component
 *
 * A feature-rich JavaScript code editor powered by CodeMirror 6.
 * Includes syntax highlighting, autocompletion, linting, code folding,
 * and all modern IDE features for Expression, Function, and Script nodes.
 *
 * @module code-editor
 */

export { JavaScriptEditor } from './JavaScriptEditor';
export { CodeDiffView } from './CodeDiffView';
export type { CodeDiffViewProps } from './CodeDiffView';
// AIX-009: markdown source view for project docs.
export { MarkdownEditor } from './MarkdownEditor';
export type { MarkdownEditorProps } from './MarkdownEditor';
export { markdownExtensions, markdownLanguage } from './markdown-language';
export type { JavaScriptEditorProps, ValidationType } from './utils/types';
export type { CodeHistoryProvider, CodeSnapshot } from './CodeHistory/types';
export { defaultPlaceholder, isValidatedType, modeLabel } from './utils/modes';
export { lintMessages } from './utils/esLintDiagnostics';
export type { LintMessage } from './utils/esLintDiagnostics';
export { summariseDiff } from './utils/diffSummary';
export type { DiffSummary } from './utils/diffSummary';
// FUN-001: the notation, written down once. Every surface that puts `Inputs.` /
// `Outputs.` in front of a beginner — the seed, the fix-it, the rail, the bar —
// imports from here rather than concatenating its own.
// FUN-009 adds `expressionPortNote`, the Expression editor's half of the same
// contract — and the one export here that no surface reads yet, because the bar
// that renders it is FUN-006.
export {
  NOTATION_RULES,
  SEED_FUNCTION_BODY,
  canExpressPort,
  expressionPortNote,
  readExpression,
  stripPortPrefix,
  writeExpression
} from './utils/notation';
export type { ExpressionPortNote, NotationMode, PortKind } from './utils/notation';
// FH-019: what the editor tells the code editor about the open project. The
// editor writes it once at boot (`models/CodeAuthoringContext`); every code
// editor in the app reads it, which is what keeps the four call sites identical
// without any of them being edited.
export { setCodeAuthoringContext, getCodeAuthoringContext, EMPTY_AUTHORING_CONTEXT } from './authoringContext';
export type { CodeAuthoringContext, AuthoringLibrary } from './authoringContext';
// FUN-003: and what it knows about the one node whose code is open. Written when
// a code popout opens and cleared when it closes — a per-editor slot, unlike the
// project surface above.
export { setOpenNodeContext } from './authoringContext';
export type { OpenNodeFact, PortFact } from './authoringContext';
export { collectDeclaredPorts, declaredPortsEqual, modeHasDeclaredPorts } from './utils/declaredPorts';
export type { DeclaredPorts } from './utils/declaredPorts';
// Phase 61's prelude: the two lists above and `minePorts` composed into one, for
// the four surfaces that want every port a node has rather than one route's half.
// The two sources stay separate — see the module header for why that matters.
export { unionPorts } from './utils/unionPorts';
export type { UnionPort, UnionPorts } from './utils/unionPorts';
// FUN-007 §2: the last run's error, anchored in the gutter. The runtime has
// emitted the mapped line/column/hint since 2026-08-12; this is what renders it.
export { setRuntimeDiagnostic } from './utils/runtimeDiagnostic';
export type { RuntimeDiagnostic } from './utils/runtimeDiagnostic';
