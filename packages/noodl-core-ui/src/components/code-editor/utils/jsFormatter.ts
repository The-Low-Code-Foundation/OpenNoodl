/**
 * JavaScript Formatting Utilities
 *
 * Simple indentation and formatting for JavaScript code.
 * Not a full formatter, just basic readability improvements.
 *
 * @module code-editor/utils
 */

/**
 * Format JavaScript code with basic indentation
 *
 * This is a simple formatter that:
 * - Adds indentation after opening braces
 * - Removes indentation after closing braces
 * - Adds newlines for readability
 *
 * Not perfect, but good enough for small code snippets.
 */
export function formatJavaScript(code: string): string {
  if (!code || code.trim() === '') {
    return code;
  }

  let formatted = '';
  let indentLevel = 0;
  const indentSize = 2; // 2 spaces per indent
  let inString = false;
  let stringChar = '';

  // Remove existing whitespace for consistent formatting
  const trimmed = code.trim();

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : '';
    const nextChar = i < trimmed.length - 1 ? trimmed[i + 1] : '';

    // Track string state to avoid formatting inside strings
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Don't format inside strings
    if (inString) {
      formatted += char;
      continue;
    }

    // Handle opening brace
    if (char === '{') {
      formatted += char;
      indentLevel++;
      if (nextChar !== '}') {
        formatted += '\n' + ' '.repeat(indentLevel * indentSize);
      }
      continue;
    }

    // Handle closing brace
    if (char === '}') {
      indentLevel = Math.max(0, indentLevel - 1);
      // Add newline before closing brace if there's content before it
      if (prevChar !== '{' && prevChar !== '\n') {
        formatted += '\n' + ' '.repeat(indentLevel * indentSize);
      }
      formatted += char;
      continue;
    }

    // Handle semicolon (add newline after)
    if (char === ';') {
      formatted += char;
      if (nextChar && nextChar !== '\n' && nextChar !== '}') {
        formatted += '\n' + ' '.repeat(indentLevel * indentSize);
      }
      continue;
    }

    // Skip multiple consecutive spaces/newlines
    if ((char === ' ' || char === '\n') && (prevChar === ' ' || prevChar === '\n')) {
      continue;
    }

    // Replace newlines with properly indented newlines
    if (char === '\n') {
      formatted += '\n' + ' '.repeat(indentLevel * indentSize);
      continue;
    }

    formatted += char;
  }

  return formatted.trim();
}
