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
export type { JavaScriptEditorProps, ValidationType, ValidationResult } from './utils/types';
export { validateJavaScript } from './utils/jsValidator';
export { formatJavaScript } from './utils/jsFormatter';
