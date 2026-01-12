'use strict';

const difference = require('lodash.difference');
const ExpressionEvaluator = require('../../expression-evaluator');

const ExpressionNode = {
  name: 'Expression',
  docs: 'https://docs.noodl.net/nodes/math/expression',
  usePortAsLabel: 'expression',
  category: 'CustomCode',
  color: 'javascript',
  nodeDoubleClickAction: {
    focusPort: 'Expression'
  },
  searchTags: ['javascript'],
  initialize: function () {
    var internal = this._internal;

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
    _onNodeDeleted: function () {
      // Clean up reactive subscriptions to prevent memory leaks
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }
    },
    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) {
        return;
      }

      this._internal.scope[name] = 0;
      this._inputValues[name] = 0;

      this.registerInput(name, {
        set: function (value) {
          this._internal.scope[name] = value;
          if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
        }
      });
    },
    _scheduleEvaluateExpression: function () {
      var internal = this._internal;
      if (internal.hasScheduledEvaluation === false) {
        internal.hasScheduledEvaluation = true;
        this.flagDirty();
        this.scheduleAfterInputsHaveUpdated(function () {
          var lastValue = internal.cachedValue;
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
    _calculateExpression: function () {
      var internal = this._internal;

      if (!internal.compiledFunction) {
        internal.compiledFunction = this._compileFunction();
      }

      for (var i = 0; i < internal.inputNames.length; ++i) {
        var inputValue = internal.scope[internal.inputNames[i]];
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
    _compileFunction: function () {
      var expression = this._internal.currentExpression;
      var args = Object.keys(this._internal.scope);

      // Add 'Noodl' as last parameter for backward compatibility
      args.push('Noodl');

      var key = expression + args.join(' ');

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
  getInspectInfo() {
    return this._internal.cachedValue;
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
      set: function (value) {
        var internal = this._internal;
        internal.currentExpression = functionPreamble + 'return (' + value + ');';
        internal.compiledFunction = undefined;

        var newInputs = parsePorts(value);

        var inputsToAdd = difference(newInputs, internal.inputNames);
        var inputsToRemove = difference(internal.inputNames, newInputs);

        var self = this;
        inputsToRemove.forEach(function (name) {
          self.deregisterInput(name);
          delete internal.scope[name];
        });

        inputsToAdd.forEach(function (name) {
          if (self.hasInput(name)) {
            return;
          }

          self.registerInput(name, {
            set: function (value) {
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
      valueChangedToTrue: function () {
        this._scheduleEvaluateExpression();
      }
    }
  },
  outputs: {
    result: {
      group: 'Result',
      type: '*',
      displayName: 'Result',
      getter: function () {
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
      getter: function () {
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
      getter: function () {
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
      getter: function () {
        const val = this._internal.cachedValue;
        return val !== undefined && val !== null ? String(val) : '';
      }
    },
    asNumber: {
      group: 'Typed Results',
      type: 'number',
      displayName: 'As Number',
      getter: function () {
        const val = this._internal.cachedValue;
        return typeof val === 'number' ? val : Number(val) || 0;
      }
    },
    asBoolean: {
      group: 'Typed Results',
      type: 'boolean',
      displayName: 'As Boolean',
      getter: function () {
        return !!this._internal.cachedValue;
      }
    }
  }
};

var functionPreamble = [
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
function construct(constructor, args) {
  function F() {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new F();
}

var compiledFunctionsCache = {};

var portsToIgnore = [
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

function parsePorts(expression) {
  var ports = [];

  function addPort(name) {
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
  var identifiers = expression.matchAll(/[a-zA-Z\_\$][a-zA-Z0-9\.\_\$]*/g);
  for (const _id of identifiers) {
    var name = _id[0];
    if (name.indexOf('.') !== -1) {
      name = name.split('.')[0]; // Take first symbol on "." sequence
    }

    addPort(name);
  }

  return ports;
}

function updatePorts(nodeId, expression, editorConnection) {
  var portNames = parsePorts(expression);

  var ports = portNames.map(function (name) {
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

function evalCompileWarnings(editorConnection, node) {
  const expression = node.parameters.expression;
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
    const deps = ExpressionEvaluator.detectDependencies(expression);
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

module.exports = {
  node: ExpressionNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Expression', function (node) {
      if (node.parameters.expression) {
        updatePorts(node.id, node.parameters.expression, context.editorConnection);
        evalCompileWarnings(context.editorConnection, node);
      }
      node.on('parameterUpdated', function (event) {
        if (event.name === 'expression') {
          updatePorts(node.id, node.parameters.expression, context.editorConnection);
          evalCompileWarnings(context.editorConnection, node);
        }
      });
    });
  }
};
