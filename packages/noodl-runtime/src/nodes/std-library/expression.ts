'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import Node = require('../../node');

const difference = require('lodash.difference');
const ExpressionEvaluator = require('../../expression-evaluator');

/** The Noodl globals an expression may read, as `detectDependencies` reports them. */
interface NoodlDependencies {
  variables: string[];
  objects: string[];
  arrays: string[];
}

/**
 * `this` inside the Expression node.
 *
 * The port set is `runtime-discovered` in the strongest sense: the inputs are whatever
 * identifiers appear in the user's expression text, found by {@link parsePorts}. Nothing
 * about that set is knowable statically, which is why the catalog records the mechanism
 * rather than the ports.
 *
 * `scope` holds the current value of each such input by name; `inputNames`/`inputValues`
 * are the same data flattened into positional arrays, because the compiled function takes
 * its inputs as ordered arguments.
 */
interface ExpressionNodeInstance extends NodeInstance {
  _internal: {
    scope: Record<string, unknown>;
    hasScheduledEvaluation: boolean;
    code?: string;
    cachedValue: unknown;
    /** The full function body, preamble included — not the raw text the author typed. */
    currentExpression: string;
    compiledFunction?: (...args: unknown[]) => unknown;
    inputNames: string[];
    inputValues: unknown[];
    noodlDependencies: NoodlDependencies;
    unsubscribe: (() => void) | null;
  };
  /** Mutable here: `registerInputIfNeeded` seeds a value before the port exists. */
  _inputValues: Record<string, unknown>;
  _scheduleEvaluateExpression(): void;
  _calculateExpression(): unknown;
  _compileFunction(): (...args: unknown[]) => unknown;
}

const ExpressionNode: NodeDefinitionOptions = {
  name: 'Expression',
  docs: 'https://docs.noodl.net/nodes/math/expression',
  usePortAsLabel: 'expression',
  category: 'CustomCode',
  color: 'javascript',
  nodeDoubleClickAction: {
    focusPort: 'Expression'
  },
  searchTags: ['javascript'],
  initialize: function (this: ExpressionNodeInstance) {
    const internal = this._internal;

    internal.scope = {};
    internal.hasScheduledEvaluation = false;

    internal.code = undefined;
    internal.cachedValue = 0;
    internal.currentExpression = '';
    internal.compiledFunction = undefined;
    internal.inputNames = [];
    internal.inputValues = [];

    // New: Expression evaluator integration
    internal.noodlDependencies = { variables: [], objects: [], arrays: [] };
    internal.unsubscribe = null;
  },
  methods: {
    // Own cleanup first, then chain — the order every sibling that overrides this uses
    // (see `componentinstance.ts`). This used not to chain at all, so a deleted Expression
    // node never cleared its model listeners, never set `_deleted`, and never unsubscribed
    // its port-level expression subscriptions (PLAT-003 NOTES §25.3 item 3).
    _onNodeDeleted: function (this: ExpressionNodeInstance) {
      // Clean up reactive subscriptions to prevent memory leaks
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }

      Node.prototype._onNodeDeleted.call(this);
    },
    registerInputIfNeeded: function (this: ExpressionNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this._internal.scope[name] = 0;
      this._inputValues[name] = 0;

      this.registerInput(name, {
        set: function (this: ExpressionNodeInstance, value: unknown) {
          this._internal.scope[name] = value;
          if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
        }
      });
    },
    _scheduleEvaluateExpression: function (this: ExpressionNodeInstance) {
      const internal = this._internal;
      if (internal.hasScheduledEvaluation === false) {
        internal.hasScheduledEvaluation = true;
        this.flagDirty();
        this.scheduleAfterInputsHaveUpdated(function (this: ExpressionNodeInstance) {
          const lastValue = internal.cachedValue;
          internal.cachedValue = this._calculateExpression();
          if (lastValue !== internal.cachedValue) {
            this.flagOutputDirty('result');
            this.flagOutputDirty('isTrue');
            this.flagOutputDirty('isFalse');
          }
          if (internal.cachedValue) this.sendSignalOnOutput('isTrueEv');
          else this.sendSignalOnOutput('isFalseEv');
          internal.hasScheduledEvaluation = false;
        });
      }
    },
    _calculateExpression: function (this: ExpressionNodeInstance) {
      const internal = this._internal;

      if (!internal.compiledFunction) {
        internal.compiledFunction = this._compileFunction();
      }

      for (let i = 0; i < internal.inputNames.length; ++i) {
        const inputValue = internal.scope[internal.inputNames[i]];
        internal.inputValues[i] = inputValue;
      }

      // Get proper Noodl API and append as last parameter for backward compatibility
      const JavascriptNodeParser = require('../../javascriptnodeparser');
      const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context && this.context.modelScope);
      const argsWithNoodl = internal.inputValues.concat([noodlAPI]);

      try {
        return internal.compiledFunction.apply(null, argsWithNoodl);
      } catch (e) {
        console.error('Error in expression:', e.message);
      }
      return 0;
    },
    _compileFunction: function (this: ExpressionNodeInstance) {
      const expression = this._internal.currentExpression;
      const args = Object.keys(this._internal.scope);

      // Add 'Noodl' as last parameter for backward compatibility
      args.push('Noodl');

      const key = expression + args.join(' ');

      if (compiledFunctionsCache.hasOwnProperty(key) === false) {
        args.push(expression);

        try {
          compiledFunctionsCache[key] = construct(Function, args);
        } catch (e) {
          console.error('Failed to compile JS function', e.message);
        }
      }
      return compiledFunctionsCache[key];
    }
  },
  getInspectInfo(this: ExpressionNodeInstance): InspectInfo {
    // Wrapped: bare numbers/booleans render as nothing in the inspector (DEBT-006).
    return [{ type: 'value', value: this._internal.cachedValue }];
  },
  inputs: {
    expression: {
      group: 'General',
      inputPriority: 1,
      type: {
        name: 'string',
        allowEditOnly: true,
        codeeditor: 'javascript'
      },
      displayName: 'Expression',
      set: function (this: ExpressionNodeInstance, value: string) {
        const internal = this._internal;
        internal.currentExpression = functionPreamble + 'return (' + value + ');';
        internal.compiledFunction = undefined;

        const newInputs = parsePorts(value);

        const inputsToAdd: string[] = difference(newInputs, internal.inputNames);
        const inputsToRemove: string[] = difference(internal.inputNames, newInputs);

        const self = this;
        inputsToRemove.forEach(function (name) {
          self.deregisterInput(name);
          delete internal.scope[name];
        });

        inputsToAdd.forEach(function (name) {
          if (self.hasInput(name)) {
            return;
          }

          self.registerInput(name, {
            set: function (this: ExpressionNodeInstance, value: unknown) {
              internal.scope[name] = value;
              if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
            }
          });

          internal.scope[name] = 0;
          self._inputValues[name] = 0;
        });

        // Detect dependencies for reactive updates
        internal.noodlDependencies = ExpressionEvaluator.detectDependencies(value);

        // Clean up old subscription
        if (internal.unsubscribe) {
          internal.unsubscribe();
          internal.unsubscribe = null;
        }

        // Subscribe to Noodl global changes if expression uses them
        if (
          internal.noodlDependencies.variables.length > 0 ||
          internal.noodlDependencies.objects.length > 0 ||
          internal.noodlDependencies.arrays.length > 0
        ) {
          internal.unsubscribe = ExpressionEvaluator.subscribeToChanges(
            internal.noodlDependencies,
            function () {
              if (!self.isInputConnected('run')) {
                self._scheduleEvaluateExpression();
              }
            },
            self.context && self.context.modelScope
          );
        }

        internal.inputNames = Object.keys(internal.scope);
        if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
      }
    },
    run: {
      group: 'Actions',
      displayName: 'Run',
      type: 'signal',
      valueChangedToTrue: function (this: ExpressionNodeInstance) {
        this._scheduleEvaluateExpression();
      }
    }
  },
  outputs: {
    result: {
      group: 'Result',
      type: '*',
      displayName: 'Result',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.currentExpression) {
          return 0;
        }

        return this._internal.cachedValue;
      }
    },
    isTrue: {
      group: 'Result',
      type: 'boolean',
      displayName: 'Is True',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.currentExpression) {
          return false;
        }

        return !!this._internal.cachedValue;
      }
    },
    isFalse: {
      group: 'Result',
      type: 'boolean',
      displayName: 'Is False',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.currentExpression) {
          return true;
        }

        return !this._internal.cachedValue;
      }
    },
    isTrueEv: {
      group: 'Events',
      type: 'signal',
      displayName: 'On True'
    },
    isFalseEv: {
      group: 'Events',
      type: 'signal',
      displayName: 'On False'
    },
    // New typed outputs for better downstream compatibility
    asString: {
      group: 'Typed Results',
      type: 'string',
      displayName: 'As String',
      getter: function (this: ExpressionNodeInstance) {
        const val = this._internal.cachedValue;
        return val !== undefined && val !== null ? String(val) : '';
      }
    },
    asNumber: {
      group: 'Typed Results',
      type: 'number',
      displayName: 'As Number',
      getter: function (this: ExpressionNodeInstance) {
        const val = this._internal.cachedValue;
        return typeof val === 'number' ? val : Number(val) || 0;
      }
    },
    asBoolean: {
      group: 'Typed Results',
      type: 'boolean',
      displayName: 'As Boolean',
      getter: function (this: ExpressionNodeInstance) {
        return !!this._internal.cachedValue;
      }
    }
  }
};

const functionPreamble = [
  'var min = Math.min,' +
    '    max = Math.max,' +
    '    cos = Math.cos,' +
    '    sin = Math.sin,' +
    '    tan = Math.tan,' +
    '    sqrt = Math.sqrt,' +
    '    pi = Math.PI,' +
    '    round = Math.round,' +
    '    floor = Math.floor,' +
    '    ceil = Math.ceil,' +
    '    abs = Math.abs,' +
    '    random = Math.random,' +
    '    pow = Math.pow,' +
    '    log = Math.log,' +
    '    exp = Math.exp;' +
    // Add Noodl global context
    'try {' +
    '  var NoodlContext = (typeof Noodl !== "undefined") ? Noodl : (typeof global !== "undefined" && global.Noodl) || {};' +
    '  var Variables = NoodlContext.Variables || {};' +
    '  var Objects = NoodlContext.Objects || {};' +
    '  var Arrays = NoodlContext.Arrays || {};' +
    '} catch (e) {' +
    '  var Variables = {}, Objects = {}, Arrays = {};' +
    '}'
].join('');

//Since apply cannot be used on constructors (i.e. new Something) we need this hax
//see http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
function construct(constructor: FunctionConstructor, args: string[]) {
  function F(this: unknown) {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new (F as unknown as { new (): (...args: unknown[]) => unknown })();
}

const compiledFunctionsCache: Record<string, (...args: unknown[]) => unknown> = {};

const portsToIgnore = [
  'min',
  'max',
  'cos',
  'sin',
  'tan',
  'sqrt',
  'pi',
  'round',
  'floor',
  'ceil',
  'abs',
  'random',
  'pow',
  'log',
  'exp',
  'Math',
  'window',
  'document',
  'undefined',
  'Vars',
  'Variables',
  'Objects',
  'Arrays',
  'Noodl',
  'NoodlContext',
  'true',
  'false',
  'null',
  'Boolean'
];

/**
 * The whole `runtime-discovered` port mechanism for this node: every identifier in the
 * expression that is not a known built-in becomes an input port.
 *
 * It is a text scan, not a parse, so it is deliberately conservative in one direction only
 * — string literals are stripped first so their contents cannot mint ports, and a dotted
 * path contributes just its root. An identifier inside a comment still would.
 */
function parsePorts(expression: string): string[] {
  const ports: string[] = [];

  function addPort(name: string) {
    if (portsToIgnore.indexOf(name) !== -1) return;
    if (
      ports.some(function (p) {
        return p === name;
      })
    )
      return;

    ports.push(name);
  }

  // First remove all strings
  expression = expression.replace(/\"([^\"]*)\"/g, '').replace(/\'([^\']*)\'/g, '');

  // Extract identifiers
  const identifiers = expression.matchAll(/[a-zA-Z\_\$][a-zA-Z0-9\.\_\$]*/g);
  for (const _id of identifiers) {
    let name = _id[0];
    if (name.indexOf('.') !== -1) {
      name = name.split('.')[0]; // Take first symbol on "." sequence
    }

    addPort(name);
  }

  return ports;
}

function updatePorts(nodeId: string, expression: string, editorConnection: EditorConnectionLike) {
  const portNames = parsePorts(expression);

  const ports = portNames.map(function (name) {
    return {
      group: 'Parameters',
      name: name,
      type: {
        name: '*',
        editAsType: 'string'
      },
      plug: 'input'
    };
  });

  editorConnection.sendDynamicPorts(nodeId, ports);
}

function evalCompileWarnings(editorConnection: EditorConnectionLike, node: GraphNodeModel) {
  const expression = node.parameters.expression as string;
  if (!expression) {
    editorConnection.clearWarning(node.component.name, node.id, 'expression-compile-error');
    return;
  }

  // Validate expression syntax
  const validation = ExpressionEvaluator.validateExpression(expression);

  if (!validation.valid) {
    editorConnection.sendWarning(node.component.name, node.id, 'expression-compile-error', {
      message: 'Syntax error: ' + validation.error
    });
  } else {
    editorConnection.clearWarning(node.component.name, node.id, 'expression-compile-error');

    // Optionally show detected dependencies as info (helpful for users)
    const deps: NoodlDependencies = ExpressionEvaluator.detectDependencies(expression);
    const depCount = deps.variables.length + deps.objects.length + deps.arrays.length;

    if (depCount > 0) {
      const depList = [];
      if (deps.variables.length > 0) {
        depList.push('Variables: ' + deps.variables.join(', '));
      }
      if (deps.objects.length > 0) {
        depList.push('Objects: ' + deps.objects.join(', '));
      }
      if (deps.arrays.length > 0) {
        depList.push('Arrays: ' + deps.arrays.join(', '));
      }

      // This is just informational, not an error
      // Could be shown in a future info panel
      // For now, we'll just log it
      console.log('[Expression Node] Reactive dependencies detected:', depList.join('; '));
    }
  }
}

const ExpressionNodeModule: NodeModule = {
  node: ExpressionNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Expression', function (node: GraphNodeModel) {
      if (node.parameters.expression) {
        updatePorts(node.id, node.parameters.expression as string, context.editorConnection);
        evalCompileWarnings(context.editorConnection, node);
      }
      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'expression') {
          updatePorts(node.id, node.parameters.expression as string, context.editorConnection);
          evalCompileWarnings(context.editorConnection, node);
        }
      });
    });
  }
};

export = ExpressionNodeModule;
