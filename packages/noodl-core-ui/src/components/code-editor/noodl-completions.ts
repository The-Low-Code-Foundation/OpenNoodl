/**
 * Noodl-Specific Autocomplete
 *
 * Provides intelligent code completion for Noodl's global API:
 * - Noodl.Variables, Noodl.Objects, Noodl.Arrays
 * - Inputs, Outputs, State, Props (node context)
 * - Math helpers (min, max, cos, sin, etc.)
 *
 * @module code-editor
 */

import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';

/**
 * Noodl API structure completions
 */
const noodlCompletions = [
  // Noodl global API
  { label: 'Noodl.Variables', type: 'property', info: 'Access global variables' },
  { label: 'Noodl.Objects', type: 'property', info: 'Access objects from model scope' },
  { label: 'Noodl.Arrays', type: 'property', info: 'Access arrays from model scope' },

  // Shorthand versions
  { label: 'Variables', type: 'property', info: 'Shorthand for Noodl.Variables' },
  { label: 'Objects', type: 'property', info: 'Shorthand for Noodl.Objects' },
  { label: 'Arrays', type: 'property', info: 'Shorthand for Noodl.Arrays' },

  // Node context (for Expression/Function nodes)
  { label: 'Inputs', type: 'property', info: 'Access node input values' },
  { label: 'Outputs', type: 'property', info: 'Set node output values' },
  { label: 'State', type: 'property', info: 'Access component state' },
  { label: 'Props', type: 'property', info: 'Access component props' },

  // Math helpers
  { label: 'min', type: 'function', info: 'Math.min - Return smallest value' },
  { label: 'max', type: 'function', info: 'Math.max - Return largest value' },
  { label: 'cos', type: 'function', info: 'Math.cos - Cosine function' },
  { label: 'sin', type: 'function', info: 'Math.sin - Sine function' },
  { label: 'tan', type: 'function', info: 'Math.tan - Tangent function' },
  { label: 'sqrt', type: 'function', info: 'Math.sqrt - Square root' },
  { label: 'pi', type: 'constant', info: 'Math.PI - The pi constant (3.14159...)' },
  { label: 'round', type: 'function', info: 'Math.round - Round to nearest integer' },
  { label: 'floor', type: 'function', info: 'Math.floor - Round down' },
  { label: 'ceil', type: 'function', info: 'Math.ceil - Round up' },
  { label: 'abs', type: 'function', info: 'Math.abs - Absolute value' },
  { label: 'random', type: 'function', info: 'Math.random - Random number 0-1' },
  { label: 'pow', type: 'function', info: 'Math.pow - Power function' },
  { label: 'log', type: 'function', info: 'Math.log - Natural logarithm' },
  { label: 'exp', type: 'function', info: 'Math.exp - e to the power of x' }
];

/**
 * Get the word before the cursor
 */
function wordBefore(context: CompletionContext): { from: number; to: number; text: string } | null {
  const word = context.matchBefore(/\w*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;
  return word;
}

/**
 * Get completions for after "Noodl."
 */
function getNoodlPropertyCompletions(): CompletionResult {
  return {
    from: 0, // Will be set by caller
    options: [
      { label: 'Variables', type: 'property', info: 'Access global variables' },
      { label: 'Objects', type: 'property', info: 'Access objects from model scope' },
      { label: 'Arrays', type: 'property', info: 'Access arrays from model scope' }
    ]
  };
}

/**
 * Main Noodl completion source
 */
export function noodlCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = wordBefore(context);
  if (!word) return null;

  // Check if we're after "Noodl."
  const textBefore = context.state.doc.sliceString(Math.max(0, word.from - 6), word.from);
  if (textBefore.endsWith('Noodl.')) {
    const result = getNoodlPropertyCompletions();
    result.from = word.from;
    return result;
  }

  // Check if we're typing "Noodl" itself
  if (word.text.toLowerCase().startsWith('nood')) {
    return {
      from: word.from,
      options: [{ label: 'Noodl', type: 'namespace', info: 'Noodl global namespace' }]
    };
  }

  // General completions (always available)
  const filtered = noodlCompletions.filter((c) => c.label.toLowerCase().startsWith(word.text.toLowerCase()));

  if (filtered.length === 0) return null;

  return {
    from: word.from,
    options: filtered
  };
}
