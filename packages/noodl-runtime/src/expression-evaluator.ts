/**
 * Expression Evaluator
 *
 * Compiles JavaScript expressions with access to Noodl globals
 * and tracks dependencies for reactive updates.
 *
 * Features:
 * - Full Noodl.Variables, Noodl.Objects, Noodl.Arrays access
 * - Math helpers (min, max, cos, sin, etc.)
 * - Dependency detection and change subscription
 * - Expression versioning for future compatibility
 * - Caching of compiled functions
 *
 * This module uses *named* exports by requirement, not by preference: `node.ts`
 * ESM-named-imports five of its functions, which `export =` cannot serve (PLAT-003
 * NOTES §29.1).
 *
 * @module expression-evaluator
 * @since 1.0.0
 */

'use strict';

import type { ModelScopeLike } from '@noodl/types';

import ModelImport = require('./model');

const Model = ModelImport as unknown as ModelScopeLike;

// Expression system version - increment when context changes
export const EXPRESSION_VERSION = 1;

/** A compiled expression, called with the Noodl context plus every shorthand accessor. */
export type CompiledExpression = (...args: unknown[]) => unknown;

/** What an expression reads, by kind — the subscription set for reactive re-evaluation. */
export interface ExpressionDependencies {
  variables: string[];
  objects: string[];
  arrays: string[];
}

// Cache for compiled functions
const compiledFunctionsCache = new Map<string, CompiledExpression>();

// Math helpers to inject into expression context
const mathHelpers = {
  min: Math.min,
  max: Math.max,
  cos: Math.cos,
  sin: Math.sin,
  tan: Math.tan,
  sqrt: Math.sqrt,
  pi: Math.PI,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  random: Math.random,
  pow: Math.pow,
  log: Math.log,
  exp: Math.exp
};

/**
 * Detect dependencies in an expression string
 * Returns { variables: string[], objects: string[], arrays: string[] }
 *
 * @example
 * detectDependencies('Noodl.Variables.isLoggedIn ? "Hi" : "Login"')
 * // Returns: { variables: ['isLoggedIn'], objects: [], arrays: [] }
 */
export function detectDependencies(expression: string): ExpressionDependencies {
  const dependencies: ExpressionDependencies = {
    variables: [],
    objects: [],
    arrays: []
  };

  // Template-literal interpolations are code, not string content — pull them out
  // before stripping strings so `${Variables.x}` still registers a dependency.
  const interpolations = Array.from(expression.matchAll(/\$\{([^}]*)\}/g))
    .map((m) => m[1])
    .join(' ');

  // Remove strings to avoid false matches on dot-notation references.
  const exprWithoutStrings =
    expression
      .replace(/"([^"\\]|\\.)*"/g, '""')
      .replace(/'([^'\\]|\\.)*'/g, "''")
      .replace(/`([^`\\]|\\.)*`/g, '``') +
    ' ' +
    interpolations;

  // Bracket-notation keys ARE string literals, so they must be matched against the
  // original expression — stripping empties them (`Variables["x"]` → `Variables[""]`).
  const bracketSource = expression + ' ' + interpolations;

  // Array.from rather than iterating the RegExpStringIterator: the viewer's ts-jest
  // program compiles this file at a pre-ES2015 target, where that is TS2802.
  const collect = (list: string[], dotSource: string, name: string) => {
    const dotRe = new RegExp('(?:Noodl\\.)?' + name + '\\.([a-zA-Z_$][a-zA-Z0-9_$]*)', 'g');
    for (const match of Array.from(dotSource.matchAll(dotRe))) {
      if (match[1] && !list.includes(match[1])) list.push(match[1]);
    }
    const bracketRe = new RegExp('(?:Noodl\\.)?' + name + '\\[["\']([^"\']+)["\']\\]', 'g');
    for (const match of Array.from(bracketSource.matchAll(bracketRe))) {
      if (match[1] && !list.includes(match[1])) list.push(match[1]);
    }
  };

  collect(dependencies.variables, exprWithoutStrings, 'Variables');
  collect(dependencies.objects, exprWithoutStrings, 'Objects');
  collect(dependencies.arrays, exprWithoutStrings, 'Arrays');

  return dependencies;
}

/**
 * Create the Noodl context object for expression evaluation
 *
 * @param modelScope - Optional model scope (defaults to global Model)
 * @returns Noodl context with Variables, Objects, Arrays accessors
 */
export function createNoodlContext(modelScope?: ModelScopeLike) {
  const scope = modelScope || Model;

  // Get the global variables model
  const variablesModel = scope.get('--ndl--global-variables');

  return {
    Variables: variablesModel ? variablesModel.data : {},
    Objects: new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop === 'symbol') return undefined;
          const obj = scope.get(prop);
          return obj ? obj.data : undefined;
        }
      }
    ),
    Arrays: new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop === 'symbol') return undefined;
          const arr = scope.get(prop);
          return arr ? arr.data : undefined;
        }
      }
    ),
    Object: scope
  };
}

/**
 * Compile an expression string into a callable function
 *
 * @param expression - The JavaScript expression to compile
 * @returns Compiled function or null if compilation fails
 *
 * @example
 * const fn = compileExpression('min(10, 5) + 2');
 * const result = evaluateExpression(fn); // 7
 */
export function compileExpression(expression: string): CompiledExpression | null {
  const cacheKey = `v${EXPRESSION_VERSION}:${expression}`;

  if (compiledFunctionsCache.has(cacheKey)) {
    return compiledFunctionsCache.get(cacheKey);
  }

  // Build parameter list for the function
  const paramNames = ['Noodl', 'Variables', 'Objects', 'Arrays', ...Object.keys(mathHelpers)];

  // Wrap expression in a return statement. Runtime errors propagate to
  // evaluateExpression, which decides whether to swallow or rethrow them —
  // catching here would make errors unobservable to callers that need to
  // surface them (the node's editor-warning path).
  const functionBody = `
    "use strict";
    return (${expression});
  `;

  try {
    const fn = new Function(...paramNames, functionBody) as CompiledExpression;
    compiledFunctionsCache.set(cacheKey, fn);
    return fn;
  } catch (e) {
    console.error('Expression compilation error:', e.message);
    return null;
  }
}

/**
 * Evaluate a compiled expression with the current context
 *
 * @param compiledFn - The compiled expression function
 * @param modelScope - Optional model scope
 * @param options - `rethrow: true` propagates runtime errors to the caller instead of
 *   logging and returning undefined; used by the node's expression path so errors reach
 *   the editor as warnings.
 * @returns The result of the expression evaluation
 */
export function evaluateExpression(
  compiledFn: CompiledExpression | null,
  modelScope?: ModelScopeLike,
  options?: { rethrow?: boolean }
): unknown {
  if (!compiledFn) return undefined;

  const noodlContext = createNoodlContext(modelScope);
  const mathValues = Object.values(mathHelpers);

  try {
    // Pass Noodl context plus shorthand accessors
    return compiledFn(noodlContext, noodlContext.Variables, noodlContext.Objects, noodlContext.Arrays, ...mathValues);
  } catch (e) {
    if (options && options.rethrow) throw e;
    console.error('Expression evaluation error:', e.message);
    return undefined;
  }
}

/**
 * Subscribe to changes in expression dependencies
 * Returns an unsubscribe function
 *
 * @param dependencies - What the expression reads, from {@link detectDependencies}
 * @param callback - Called when any dependency changes
 * @param modelScope - Optional model scope
 * @returns Unsubscribe function
 *
 * @example
 * const deps = { variables: ['userName'], objects: [], arrays: [] };
 * const unsub = subscribeToChanges(deps, () => console.log('Changed!'));
 * // Later: unsub();
 */
export function subscribeToChanges(
  dependencies: ExpressionDependencies,
  callback: () => void,
  modelScope?: ModelScopeLike
): () => void {
  const scope = modelScope || Model;
  const listeners: Array<() => void> = [];

  // Subscribe to variable changes
  if (dependencies.variables.length > 0) {
    const variablesModel = scope.get('--ndl--global-variables');
    if (variablesModel) {
      const handler = (args) => {
        // Check if any of our dependencies changed
        if (dependencies.variables.some((v) => args.name === v || !args.name)) {
          callback();
        }
      };
      variablesModel.on('change', handler);
      listeners.push(() => variablesModel.off('change', handler));
    }
  }

  // Subscribe to object changes
  for (const objId of dependencies.objects) {
    const objModel = scope.get(objId);
    if (objModel) {
      const handler = () => callback();
      objModel.on('change', handler);
      listeners.push(() => objModel.off('change', handler));
    }
  }

  // Subscribe to array changes
  for (const arrId of dependencies.arrays) {
    const arrModel = scope.get(arrId);
    if (arrModel) {
      const handler = () => callback();
      arrModel.on('change', handler);
      listeners.push(() => arrModel.off('change', handler));
    }
  }

  // Return unsubscribe function
  return () => {
    listeners.forEach((unsub) => unsub());
  };
}

/**
 * Validate expression syntax without executing
 *
 * @param expression - The expression to validate
 *
 * @example
 * validateExpression('1 + 1'); // { valid: true, error: null }
 * validateExpression('1 +');   // { valid: false, error: 'Unexpected end of input' }
 */
export function validateExpression(expression: string): { valid: boolean; error: string | null } {
  try {
    new Function(`return (${expression})`);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Get the current expression system version
 * Used for migration when expression context changes
 *
 * @returns Current version number
 */
export function getExpressionVersion(): number {
  return EXPRESSION_VERSION;
}

/**
 * Clear the compiled functions cache
 * Useful for testing or when context changes
 */
export function clearCache(): void {
  compiledFunctionsCache.clear();
}
