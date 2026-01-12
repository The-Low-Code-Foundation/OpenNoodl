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
 * Extract line and column from error message
 */
function parseErrorLocation(error: Error): { line?: number; column?: number } {
  const message = error.message;

  // Try to extract line number from various error formats
  const lineMatch = message.match(/line (\d+)/i);
  const posMatch = message.match(/position (\d+)/i);

  return {
    line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
    column: posMatch ? parseInt(posMatch[1], 10) : undefined
  };
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
    const location = parseErrorLocation(error as Error);
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
    const location = parseErrorLocation(error as Error);
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
    default:
      return { valid: false, error: 'Unknown validation type' };
  }
}
