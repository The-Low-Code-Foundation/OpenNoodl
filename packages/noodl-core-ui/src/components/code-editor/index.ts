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
// FH-019: what the editor tells the code editor about the open project. The
// editor writes it once at boot (`models/CodeAuthoringContext`); every code
// editor in the app reads it, which is what keeps the four call sites identical
// without any of them being edited.
export { setCodeAuthoringContext, getCodeAuthoringContext, EMPTY_AUTHORING_CONTEXT } from './authoringContext';
export type { CodeAuthoringContext, AuthoringLibrary } from './authoringContext';
