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

import type { ValidationType } from './types';

const LABELS: Record<ValidationType, string> = {
  expression: 'Expression',
  function: 'Function',
  script: 'Script',
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

/** The name shown in the popout's toolbar. */
export function modeLabel(validationType: ValidationType): string {
  return LABELS[validationType] ?? 'JavaScript';
}

/** What an empty editor of this mode suggests. */
export function defaultPlaceholder(validationType: ValidationType): string {
  return PLACEHOLDERS[validationType] ?? PLACEHOLDERS.function;
}
