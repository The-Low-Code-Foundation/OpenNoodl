/**
 * JavaScript Validation Utilities
 *
 * Validates JavaScript code using the Function constructor.
 * This catches syntax errors without needing a full parser.
 *
 * @module code-editor/utils
 */

import { ValidationResult, ValidationType } from './types';

/**
 * Turn a document offset into a 1-based line and column.
 */
function offsetToLineColumn(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, Math.max(0, offset));
  const lines = before.split('\n');

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

/**
 * Extract line and column from an error message, where the engine gives one.
 *
 * `JSON.parse` reports a position; V8 phrases it as `... at position 12` on older
 * builds and `... at position 12 (line 1 column 13)` on newer ones. Syntax errors
 * from `new Function(...)` carry no position at all, and this returns nothing rather
 * than inventing one — the inline squiggles come from the parse tree instead
 * (see `syntaxDiagnostics.ts`, CED-001 A3).
 */
function parseErrorLocation(error: Error, code: string): { line?: number; column?: number } {
  const message = error.message;

  const lineColumn = message.match(/line (\d+) column (\d+)/i);
  if (lineColumn) {
    return { line: parseInt(lineColumn[1], 10), column: parseInt(lineColumn[2], 10) };
  }

  const position = message.match(/position (\d+)/i);
  if (position) {
    return offsetToLineColumn(code, parseInt(position[1], 10));
  }

  return {};
}

/**
 * Get helpful suggestion based on error message
 */
function getSuggestion(error: Error): string | undefined {
  const message = error.message.toLowerCase();

  if (message.includes('unexpected token') || message.includes('unexpected identifier')) {
    return 'Check for missing or extra brackets, parentheses, or quotes';
  }

  if (message.includes('unexpected end of input')) {
    return 'You may be missing a closing bracket or parenthesis';
  }

  if (message.includes('unexpected string') || message.includes("unexpected ','")) {
    return 'Check for missing operators or commas between values';
  }

  if (message.includes('missing') && message.includes('after')) {
    return 'Check the syntax around the indicated position';
  }

  return undefined;
}

/**
 * Validate JavaScript expression
 * Wraps code in `return ()` to validate as expression
 */
function validateExpression(code: string): ValidationResult {
  if (!code || code.trim() === '') {
    return { valid: true };
  }

  try {
    // Try to create a function that returns the expression
    // This validates that it's a valid JavaScript expression
    new Function(`return (${code});`);
    return { valid: true };
  } catch (error) {
    const location = parseErrorLocation(error as Error, code);
    return {
      valid: false,
      error: (error as Error).message,
      suggestion: getSuggestion(error as Error),
      ...location
    };
  }
}

/**
 * Validate JavaScript function body
 * Creates a function with the code as body
 */
function validateFunction(code: string): ValidationResult {
  if (!code || code.trim() === '') {
    return { valid: true };
  }

  try {
    // Create a function with the code as body
    new Function(code);
    return { valid: true };
  } catch (error) {
    const location = parseErrorLocation(error as Error, code);
    return {
      valid: false,
      error: (error as Error).message,
      suggestion: getSuggestion(error as Error),
      ...location
    };
  }
}

/**
 * Validate JavaScript script
 * Same as function validation for our purposes
 */
function validateScript(code: string): ValidationResult {
  return validateFunction(code);
}

/**
 * Validate JSON text
 * Empty text is treated as valid (matches the other validators' empty-input behavior)
 */
function validateJson(code: string): ValidationResult {
  if (!code || code.trim() === '') {
    return { valid: true };
  }

  try {
    JSON.parse(code);
    return { valid: true };
  } catch (error) {
    const location = parseErrorLocation(error as Error, code);
    return {
      valid: false,
      error: (error as Error).message,
      ...location
    };
  }
}

/**
 * Modes this module has no opinion about.
 *
 * CSS, HTML and free text are all edited here, and none of them is checkable by
 * a JavaScript parser. They report `valid` so nothing downstream has to special
 * case the result, but {@link isValidatedType} is what consumers ask before
 * *showing* a verdict — claiming "✓ Valid" over text nobody checked is the same
 * lie as the "✗ Error" these modes used to produce.
 */
const UNVALIDATED: readonly ValidationType[] = ['text', 'css', 'html'];

/** Does this mode have a validator behind it, or is the editor just holding text? */
export function isValidatedType(validationType: ValidationType): boolean {
  return !UNVALIDATED.includes(validationType);
}

/**
 * Main validation function
 * Validates JavaScript code based on validation type
 */
export function validateJavaScript(code: string, validationType: ValidationType = 'expression'): ValidationResult {
  switch (validationType) {
    case 'expression':
      return validateExpression(code);
    case 'function':
      return validateFunction(code);
    case 'script':
      return validateScript(code);
    case 'json':
      return validateJson(code);
    case 'text':
    case 'css':
    case 'html':
      return { valid: true };
    default:
      return { valid: false, error: 'Unknown validation type' };
  }
}

/**
 * Whether two verdicts say the same thing.
 *
 * The editor re-validates on every keystroke *and* whenever a controlled consumer
 * feeds the text back in; holding the previous object when nothing has changed lets
 * React skip the second render of the pair.
 */
export function isSameValidation(a: ValidationResult, b: ValidationResult): boolean {
  return (
    a.valid === b.valid &&
    a.error === b.error &&
    a.suggestion === b.suggestion &&
    a.line === b.line &&
    a.column === b.column
  );
}
