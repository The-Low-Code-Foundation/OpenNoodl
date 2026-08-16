/**
 * What each editor mode is called, and what it says when it is empty.
 *
 * Both used to be JavaScript-only constants: the toolbar derived its title from
 * a `switch` whose default was `'JavaScript'`, and the placeholder was the
 * literal `// Enter your JavaScript code here` no matter what the port held. A
 * CSS Definition's `style` port therefore opened a popout titled **EXPRESSION**
 * inviting you to enter JavaScript. Naming the modes in one table is what keeps
 * a new one from having to remember two other files.
 *
 * @module code-editor/utils
 */

import type { CodeSubject, ValidationType } from './types';

const LABELS: Record<ValidationType, string> = {
  expression: 'Expression',
  function: 'Function',
  script: 'Script',
  json: 'JSON',
  text: 'Text',
  css: 'CSS',
  html: 'HTML'
};

/**
 * The same table for a **file** (CN-019).
 *
 * Three of these names — `Expression`, `Function`, `Script` — are node types,
 * not languages. They are the right answer in a property-panel popout, which is
 * always editing one of those nodes, and the wrong one over a kit's `index.js`:
 * that file was opened in `'script'` mode because a module has top-level
 * statements a Function-node parse would reject, and the toolbar then announced
 * it as a **SCRIPT**, which is a node the author does not have.
 *
 * The rest are unchanged because they were never node names: a `.json` file and
 * a JSON parameter are both JSON.
 */
const FILE_LABELS: Record<ValidationType, string> = {
  expression: 'JavaScript',
  function: 'JavaScript',
  script: 'JavaScript',
  json: 'JSON',
  text: 'Text',
  css: 'CSS',
  html: 'HTML'
};

const PLACEHOLDERS: Record<ValidationType, string> = {
  expression: '// Enter a JavaScript expression',
  function: '// Enter your JavaScript code here',
  script: '// Enter your JavaScript code here',
  json: '{}',
  text: '',
  css: '/* Enter CSS declarations */',
  html: '<!-- Enter HTML -->'
};

/**
 * Modes nothing checks.
 *
 * CSS, HTML and free text are all edited here, and none of them is checkable by
 * a JavaScript parser. {@link isValidatedType} is what consumers ask before
 * *showing* a verdict — claiming "✓ Valid" over text nobody checked is the same
 * lie as the "✗ Error" these modes used to produce.
 *
 * Moved here from `jsValidator.ts` when FH-017 slice 2 deleted that module: it
 * is a fact about a mode, and the modes live in one table by design.
 */
const UNVALIDATED: readonly ValidationType[] = ['text', 'css', 'html'];

/** Does this mode have a linter behind it, or is the editor just holding text? */
export function isValidatedType(validationType: ValidationType): boolean {
  return !UNVALIDATED.includes(validationType);
}

/**
 * The name shown in the toolbar — of the node type in a popout, of the language
 * in a file.
 */
export function modeLabel(validationType: ValidationType, subject: CodeSubject = 'node'): string {
  const labels = subject === 'file' ? FILE_LABELS : LABELS;
  return labels[validationType] ?? 'JavaScript';
}

/** What an empty editor of this mode suggests. */
export function defaultPlaceholder(validationType: ValidationType): string {
  return PLACEHOLDERS[validationType] ?? PLACEHOLDERS.function;
}
