/**
 * JSON Validator with Helpful Error Messages
 *
 * Validates JSON and provides detailed error information with
 * suggested fixes for common mistakes. Designed to be helpful
 * for no-coders who may not understand JSON syntax.
 *
 * @module json-editor/utils
 */

import { ValidationResult } from './types';

/**
 * Validates JSON string and provides detailed error information with fix suggestions.
 *
 * @param jsonString - The JSON string to validate
 * @param expectedType - Optional type constraint ('array' | 'object' | 'any')
 * @returns Validation result with error details and suggestions
 *
 * @example
 * ```typescript
 * const result = validateJSON('[1, 2, 3]', 'array');
 * if (result.valid) {
 *   console.log('Valid!', result.value);
 * } else {
 *   console.error(result.error, result.suggestion);
 * }
 * ```
 */
export function validateJSON(jsonString: string, expectedType?: 'array' | 'object' | 'any'): ValidationResult {
  // Handle empty input
  if (!jsonString || jsonString.trim() === '') {
    return {
      valid: false,
      error: 'Empty input',
      suggestion: expectedType === 'array' ? 'Start with [ ] for an array' : 'Start with { } for an object'
    };
  }

  const trimmed = jsonString.trim();

  try {
    // Attempt to parse
    const parsed = JSON.parse(trimmed);

    // Check type constraints
    if (expectedType === 'array' && !Array.isArray(parsed)) {
      return {
        valid: false,
        error: 'Expected an array, but got an object',
        suggestion: 'Wrap your data in [ ] brackets to make it an array. Example: [ {...} ]'
      };
    }

    if (expectedType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      return {
        valid: false,
        error: 'Expected an object, but got ' + (Array.isArray(parsed) ? 'an array' : typeof parsed),
        suggestion: 'Wrap your data in { } braces to make it an object. Example: { "key": "value" }'
      };
    }

    // Valid!
    return {
      valid: true,
      value: parsed
    };
  } catch (error) {
    // Parse the error to provide helpful feedback
    return parseJSONError(error as SyntaxError, trimmed);
  }
}

/**
 * Parses a JSON.parse() error and extracts helpful information
 *
 * @param error - The SyntaxError from JSON.parse()
 * @param jsonString - The original JSON string
 * @returns Validation result with detailed error and suggestions
 */
function parseJSONError(error: SyntaxError, jsonString: string): ValidationResult {
  const message = error.message;

  // Extract position from error message
  // Error messages typically look like: "Unexpected token } in JSON at position 42"
  const positionMatch = message.match(/position (\d+)/);
  const position = positionMatch ? parseInt(positionMatch[1], 10) : null;

  // Calculate line and column from position
  let line = 1;
  let column = 1;
  if (position !== null) {
    const lines = jsonString.substring(0, position).split('\n');
    line = lines.length;
    column = lines[lines.length - 1].length + 1;
  }

  // Analyze the error and provide helpful suggestions
  const suggestion = getErrorSuggestion(message, jsonString, position);

  return {
    valid: false,
    error: `Line ${line}, Column ${column}: ${extractSimpleError(message)}`,
    line,
    column,
    suggestion
  };
}

/**
 * Extracts a simple, user-friendly error message from the technical error
 *
 * @param message - The technical error message from JSON.parse()
 * @returns Simplified error message
 */
function extractSimpleError(message: string): string {
  // Common patterns
  if (message.includes('Unexpected token')) {
    const tokenMatch = message.match(/Unexpected token ([^\s]+)/);
    const token = tokenMatch ? tokenMatch[1] : 'character';
    return `Unexpected ${token}`;
  }

  if (message.includes('Unexpected end of JSON')) {
    return 'Unexpected end of JSON';
  }

  if (message.includes('Unexpected string')) {
    return 'Unexpected string';
  }

  if (message.includes('Unexpected number')) {
    return 'Unexpected number';
  }

  // Default to original message
  return message;
}

/**
 * Provides a helpful suggestion based on the error message and context
 *
 * @param message - The error message from JSON.parse()
 * @param jsonString - The original JSON string
 * @param position - The error position in the string
 * @returns A helpful suggestion for fixing the error
 */
function getErrorSuggestion(message: string, jsonString: string, position: number | null): string {
  const lower = message.toLowerCase();

  // Missing closing bracket/brace
  if (lower.includes('unexpected end of json') || lower.includes('unterminated')) {
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/]/g) || []).length;

    if (openBraces > closeBraces) {
      return `Missing ${openBraces - closeBraces} closing } brace(s) at the end`;
    }
    if (openBrackets > closeBrackets) {
      return `Missing ${openBrackets - closeBrackets} closing ] bracket(s) at the end`;
    }
    return 'Check if you have matching { } braces and [ ] brackets';
  }

  // Missing comma
  if (lower.includes('unexpected token') && position !== null) {
    const context = jsonString.substring(Math.max(0, position - 20), position);
    const nextChar = jsonString[position];

    // Check if previous line ended without comma
    if (context.includes('"') && (nextChar === '"' || nextChar === '{' || nextChar === '[')) {
      return 'Add a comma (,) after the previous property or value';
    }

    // Unexpected } or ]
    if (nextChar === '}' || nextChar === ']') {
      return 'Remove the trailing comma before the closing bracket';
    }

    // Unexpected :
    if (nextChar === ':') {
      return 'Property keys must be wrapped in "quotes"';
    }
  }

  // Unexpected token } or ]
  if (lower.includes('unexpected token }')) {
    return 'Either remove this extra } brace, or add a comma before it if there should be more properties';
  }

  if (lower.includes('unexpected token ]')) {
    return 'Either remove this extra ] bracket, or add a comma before it if there should be more items';
  }

  // Unexpected string
  if (lower.includes('unexpected string')) {
    return 'Add a comma (,) between values, or check if a property key needs a colon (:)';
  }

  // Missing quotes around key
  if (lower.includes('unexpected token') && position !== null && jsonString[position] !== '"') {
    const context = jsonString.substring(Math.max(0, position - 10), position + 10);
    if (context.includes(':')) {
      return 'Property keys must be wrapped in "double quotes"';
    }
  }

  // Single quotes instead of double quotes
  if (jsonString.includes("'")) {
    return 'JSON requires "double quotes" for strings, not \'single quotes\'';
  }

  // Trailing comma
  if (lower.includes('unexpected token }') || lower.includes('unexpected token ]')) {
    return 'Remove the trailing comma before the closing bracket';
  }

  // Generic help
  return 'Check for common issues: missing commas, unmatched brackets { } [ ], or keys without "quotes"';
}

/**
 * Formats JSON string with proper indentation
 *
 * @param jsonString - The JSON string to format
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns Formatted JSON string or original if invalid
 */
export function formatJSON(jsonString: string, indent: number = 2): string {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, indent);
  } catch {
    // Return original if invalid
    return jsonString;
  }
}

/**
 * Checks if a string is valid JSON without throwing errors
 *
 * @param jsonString - The string to check
 * @returns True if valid JSON
 */
export function isValidJSON(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}
