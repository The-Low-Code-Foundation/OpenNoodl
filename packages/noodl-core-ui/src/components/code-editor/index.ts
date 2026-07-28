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
export type { JavaScriptEditorProps, ValidationType, ValidationResult } from './utils/types';
export type { CodeHistoryProvider, CodeSnapshot } from './CodeHistory/types';
export { validateJavaScript } from './utils/jsValidator';
export { summariseDiff } from './utils/diffSummary';
export type { DiffSummary } from './utils/diffSummary';
