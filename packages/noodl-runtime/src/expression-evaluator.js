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
 * @module expression-evaluator
 * @since 1.0.0
 */

'use strict';

const Model = require('./model');

// Expression system version - increment when context changes
const EXPRESSION_VERSION = 1;

// Cache for compiled functions
const compiledFunctionsCache = new Map();

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
 * @param {string} expression - The JavaScript expression to analyze
 * @returns {{ variables: string[], objects: string[], arrays: string[] }}
 *
 * @example
 * detectDependencies('Noodl.Variables.isLoggedIn ? "Hi" : "Login"')
 * // Returns: { variables: ['isLoggedIn'], objects: [], arrays: [] }
 */
function detectDependencies(expression) {
  const dependencies = {
    variables: [],
    objects: [],
    arrays: []
  };

  // Remove strings to avoid false matches
  const exprWithoutStrings = expression
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/`([^`\\]|\\.)*`/g, '``');

  // Match Noodl.Variables.X or Noodl.Variables["X"] or Variables.X or Variables["X"]
  const variableMatches = exprWithoutStrings.matchAll(
    /(?:Noodl\.)?Variables\.([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:Noodl\.)?Variables\[["']([^"']+)["']\]/g
  );
  for (const match of variableMatches) {
    const varName = match[1] || match[2];
    if (varName && !dependencies.variables.includes(varName)) {
      dependencies.variables.push(varName);
    }
  }

  // Match Noodl.Objects.X or Noodl.Objects["X"] or Objects.X or Objects["X"]
  const objectMatches = exprWithoutStrings.matchAll(
    /(?:Noodl\.)?Objects\.([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:Noodl\.)?Objects\[["']([^"']+)["']\]/g
  );
  for (const match of objectMatches) {
    const objId = match[1] || match[2];
    if (objId && !dependencies.objects.includes(objId)) {
      dependencies.objects.push(objId);
    }
  }

  // Match Noodl.Arrays.X or Noodl.Arrays["X"] or Arrays.X or Arrays["X"]
  const arrayMatches = exprWithoutStrings.matchAll(
    /(?:Noodl\.)?Arrays\.([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:Noodl\.)?Arrays\[["']([^"']+)["']\]/g
  );
  for (const match of arrayMatches) {
    const arrId = match[1] || match[2];
    if (arrId && !dependencies.arrays.includes(arrId)) {
      dependencies.arrays.push(arrId);
    }
  }

  return dependencies;
}

/**
 * Create the Noodl context object for expression evaluation
 *
 * @param {Model.Scope} [modelScope] - Optional model scope (defaults to global Model)
 * @returns {Object} Noodl context with Variables, Objects, Arrays accessors
 */
function createNoodlContext(modelScope) {
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
 * @param {string} expression - The JavaScript expression to compile
 * @returns {Function|null} Compiled function or null if compilation fails
 *
 * @example
 * const fn = compileExpression('min(10, 5) + 2');
 * const result = evaluateExpression(fn); // 7
 */
function compileExpression(expression) {
  const cacheKey = `v${EXPRESSION_VERSION}:${expression}`;

  if (compiledFunctionsCache.has(cacheKey)) {
    return compiledFunctionsCache.get(cacheKey);
  }

  // Build parameter list for the function
  const paramNames = ['Noodl', 'Variables', 'Objects', 'Arrays', ...Object.keys(mathHelpers)];

  // Wrap expression in return statement with error handling
  const functionBody = `
    "use strict";
    try {
      return (${expression});
    } catch (e) {
      console.error('Expression evaluation error:', e.message);
      return undefined;
    }
  `;

  try {
    const fn = new Function(...paramNames, functionBody);
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
 * @param {Function|null} compiledFn - The compiled expression function
 * @param {Model.Scope} [modelScope] - Optional model scope
 * @returns {*} The result of the expression evaluation
 */
function evaluateExpression(compiledFn, modelScope) {
  if (!compiledFn) return undefined;

  const noodlContext = createNoodlContext(modelScope);
  const mathValues = Object.values(mathHelpers);

  try {
    // Pass Noodl context plus shorthand accessors
    return compiledFn(noodlContext, noodlContext.Variables, noodlContext.Objects, noodlContext.Arrays, ...mathValues);
  } catch (e) {
    console.error('Expression evaluation error:', e.message);
    return undefined;
  }
}

/**
 * Subscribe to changes in expression dependencies
 * Returns an unsubscribe function
 *
 * @param {{ variables: string[], objects: string[], arrays: string[] }} dependencies
 * @param {Function} callback - Called when any dependency changes
 * @param {Model.Scope} [modelScope] - Optional model scope
 * @returns {Function} Unsubscribe function
 *
 * @example
 * const deps = { variables: ['userName'], objects: [], arrays: [] };
 * const unsub = subscribeToChanges(deps, () => console.log('Changed!'));
 * // Later: unsub();
 */
function subscribeToChanges(dependencies, callback, modelScope) {
  const scope = modelScope || Model;
  const listeners = [];

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
 * @param {string} expression - The expression to validate
 * @returns {{ valid: boolean, error: string|null }}
 *
 * @example
 * validateExpression('1 + 1'); // { valid: true, error: null }
 * validateExpression('1 +');   // { valid: false, error: 'Unexpected end of input' }
 */
function validateExpression(expression) {
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
 * @returns {number} Current version number
 */
function getExpressionVersion() {
  return EXPRESSION_VERSION;
}

/**
 * Clear the compiled functions cache
 * Useful for testing or when context changes
 */
function clearCache() {
  compiledFunctionsCache.clear();
}

module.exports = {
  detectDependencies,
  compileExpression,
  evaluateExpression,
  subscribeToChanges,
  validateExpression,
  createNoodlContext,
  getExpressionVersion,
  clearCache,
  EXPRESSION_VERSION
};
