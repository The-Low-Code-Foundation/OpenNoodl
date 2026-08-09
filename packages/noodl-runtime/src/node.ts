import type { NodeVariant } from '@noodl/types';

import type { NodeModelParameterUpdatedEvent, RuntimeNode, RuntimeNodeContext } from './internal';

import OutputProperty = require('./outputproperty');
import {
  evaluateExpression,
  compileExpression,
  detectDependencies,
  subscribeToChanges,
  validateExpression
} from './expression-evaluator';
import { coerceToType } from './expression-type-coercion';
import { diagnosticsEnabled, setDiagnostic } from './diagnostics';
import { COMPLETED_PORT, TREAT_UNCHANGED_AS } from './outcome';
import { runOnChangeInput, runOnChangePortName, runOnValueChange } from './run-on-value-change';

/**
 * OBS-003. The port name is appended, so one node with two NaN inputs raises two clearable
 * diagnostics rather than one that flickers between them. Interpolating a *port* into a key is
 * allowed by the contract (the port set is finite and stable); interpolating a *value* is not.
 */
const NAN_INPUT_KEY = 'node/nan-input/';

/**
 * A parameter whose value is computed from an expression rather than stored literally.
 *
 * `fallback` is what the port receives whenever compilation or evaluation fails, so an
 * expression error degrades to a usable value instead of leaving the port unset.
 */
interface ExpressionParameter {
  mode: 'expression';
  expression: string;
  fallback?: unknown;
}

/**
 * One queue entry standing for a whole signal pulse — the `true` and the `false` that
 * follow it — rather than two entries.
 *
 * This exists because inputs are queued per port and drained one entry per port per pass.
 * A value input queues one entry per event; a signal queued as two entries therefore
 * advances at half the rate, and the pairing between a value and the signal that consumes
 * it slips apart as soon as two events are queued before the node updates. With a stream —
 * `SSE.text -> chunk`, `SSE.onMessage -> add` — that shows up as every other token dropped
 * and the last one repeated for the leftover signals, which is exactly what the agent-chat
 * example did on its first real run. Delivering the pulse as one entry keeps a value and
 * its signal in step no matter how many events arrive in one iteration.
 */
const SIGNAL_PULSE = Object.freeze({ __noodlSignalPulse: true });

/**
 * Helper to check if a value is an expression parameter
 */
function isExpressionParameter(value: unknown): value is ExpressionParameter {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    (value as ExpressionParameter).mode === 'expression' &&
    typeof (value as ExpressionParameter).expression === 'string'
  );
}

interface NodeConstructor {
  new (context: RuntimeNodeContext, id: string): RuntimeNode;
  (this: RuntimeNode, context: RuntimeNodeContext, id: string): void;
  prototype: RuntimeNode;
}

/**
 * Base class for all Nodes.
 *
 * Deliberately a constructor function rather than a `class`: `nodedefinition.ts` builds
 * each node type with `Node.call(this, context, id)` and `Object.create(Node.prototype)`,
 * neither of which works against an ES class.
 */
const Node = function Node(this: RuntimeNode, context: RuntimeNodeContext, id: string) {
  this.id = id;
  this.context = context;
  this._dirty = false;

  this._inputs = {};
  this._inputValues = {};
  this._outputs = {};

  this._inputConnections = {};
  this._outputList = [];
  this._isUpdating = false;
  this._inputValuesQueue = {};
  /** OBS-001: shifted in lockstep with `_inputValuesQueue`, populated only while tracing. */
  this._inputCauseQueue = {};
  this._afterInputsHaveUpdatedCallbacks = [];

  this._internal = {};
  this._signalsSentThisUpdate = {};

  this._deleted = false;
  this._deleteListeners = [];
  this._isFirstUpdate = true;

  this._valuesFromConnections = {};
  this.updateOnDirtyFlagging = true;

  // NDA-017 §2. Only ever holds *deliberate* answers — an input the author has not touched
  // is absent here and reads as ticked. See `run-on-value-change.ts` for why the default
  // cannot live on the port instead.
  this._runOnValueChange = {};

  // Expression subscriptions: { [portName]: { unsub: unsubscribeFn, expression: string } }
  this._expressionSubscriptions = {};

  // Ports currently showing an `expression-error-<port>` warning in the editor. Lazily
  // created, because most nodes never raise one and this is allocated per node instance.
  // See `_clearExpressionError` for why the subscription map above cannot answer this.
  this._expressionErrorPorts = null;
} as unknown as NodeConstructor;

Node.prototype.getInputValue = function (name) {
  return this._inputValues[name];
};

Node.prototype.registerInput = function (name, input) {
  if (this.hasInput(name)) {
    throw new Error('Input property ' + name + ' already registered');
  }

  this._inputs[name] = input;

  const type = input.type as { units?: string[]; defaultUnit?: string } | undefined;

  if (type && type.units) {
    const defaultUnit = type.defaultUnit || type.units[0];
    this._inputValues[name] = {
      value: input.default,
      type: defaultUnit
    };
  } else if (input.hasOwnProperty('default')) {
    this._inputValues[name] = input.default;
  }
};

Node.prototype.deregisterInput = function (name) {
  if (this.hasInput(name) === false) {
    throw new Error('Input property ' + name + " doesn't exist");
  }
  delete this._inputs[name];
  delete this._inputValues[name];
};

Node.prototype.registerInputs = function (inputs) {
  for (const name in inputs) {
    this.registerInput(name, inputs[name]);
  }
};

Node.prototype.getInput = function (name) {
  if (this.hasInput(name) === false) {
    console.log('Node ' + this.name + ': Invalid input property ' + name);
    return undefined;
  }

  return this._inputs[name];
};

Node.prototype.hasInput = function (name) {
  return name in this._inputs;
};

Node.prototype.registerInputIfNeeded = function () {
  //noop, can be overriden by subclasses
};

/**
 * NDA-017 §2 — whether a new value on `inputName` should re-run this node.
 *
 * This is the replacement for `!this.isInputConnected('<control signal>')` at every value
 * setter in the twelve-family class. It answers `true` for an input the author has never
 * touched, so wiring the control signal no longer changes what the other ports do; the only
 * thing that does is unticking a box.
 *
 * See `run-on-value-change.ts` for the decision this implements and the four constraints it
 * has to hold.
 */
Node.prototype.shouldRunOnValueChange = function (inputName) {
  return runOnValueChange(this, inputName);
};

/**
 * Register the checkbox port governing an input discovered at runtime.
 *
 * Declared inputs get theirs from `defineNode`, which synthesises them from the
 * `runOnValueChange` field on the node definition. The four families whose governed inputs
 * come from user text or a schema have to mint them alongside the port they govern.
 */
Node.prototype.registerRunOnValueChangeInput = function (inputName, displayName) {
  const portName = runOnChangePortName(inputName);
  if (this.hasInput(portName)) return;
  this.registerInput(portName, runOnChangeInput(inputName, displayName));
};

/** Drop the checkbox port for an input that no longer exists, and forget its answer. */
Node.prototype.deregisterRunOnValueChangeInput = function (inputName) {
  const portName = runOnChangePortName(inputName);
  if (this.hasInput(portName)) this.deregisterInput(portName);
  delete this._runOnValueChange[inputName];
};

/** Raise (or refresh) the expression error the editor draws on this port. */
Node.prototype._raiseExpressionError = function (portName, message) {
  if (!this.context || !this.context.editorConnection) return;

  this.context.editorConnection.sendWarning(
    this.nodeScope.componentOwner.name,
    this.id,
    'expression-error-' + portName,
    {
      showGlobally: true,
      message
    }
  );

  if (this._expressionErrorPorts === null) this._expressionErrorPorts = {};
  this._expressionErrorPorts[portName] = true;
};

/**
 * Take back the expression error on this port, if one is up.
 *
 * ⚠️ Guarded on a marker rather than cleared unconditionally, because the caller that
 * matters is the *plain value* path — every input set in the runtime, several per frame
 * for anything animated. Unguarded, each one would build the `'expression-error-' + port`
 * key and call through to `EditorConnection`, for a node that has never seen an
 * expression. `ActiveWarnings` would swallow the message, but only after the work.
 *
 * The marker is its own state because `_expressionSubscriptions` cannot stand in for it:
 * an expression is only subscribed when it has dependencies to watch, and an expression
 * that fails to *compile* — the case this whole path exists for — never gets that far.
 */
Node.prototype._clearExpressionError = function (portName) {
  if (this._expressionErrorPorts === null || !this._expressionErrorPorts[portName]) return;

  delete this._expressionErrorPorts[portName];

  // `nodeScope` is checked because this also runs during teardown, where a throw would
  // take the rest of the delete handling with it.
  if (this.context && this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner) {
    this.context.editorConnection.clearWarning(
      this.nodeScope.componentOwner.name,
      this.id,
      'expression-error-' + portName
    );
  }
};

/**
 * Evaluate an expression parameter and return the coerced result.
 * Also sets up reactive subscriptions so the node updates when dependencies change.
 *
 * Returns the value unchanged when it is not an expression parameter.
 */
Node.prototype._evaluateExpressionParameter = function (paramValue, portName) {
  // Check if this is an expression parameter
  if (!isExpressionParameter(paramValue)) {
    // Clean up any existing subscription for this port since it's no longer an expression
    if (this._expressionSubscriptions[portName]) {
      const sub = this._expressionSubscriptions[portName];
      if (sub && sub.unsub) {
        sub.unsub();
      }
      delete this._expressionSubscriptions[portName];
    }

    // ⚠️ And take back the error, which used to outlive the expression that caused it.
    // Pressing `fx` on a field that already holds prose makes that prose the expression,
    // and prose does not parse — so the error is right, and the author's fix is to press
    // `fx` again. That writes the literal back through here, where the early return above
    // used to end the story: the warning stayed raised, so the node kept its dotted ring
    // and the Problems panel kept quoting a JavaScript error about a field that is no
    // longer JavaScript. The same door lets a *deleted* parameter out — it comes back as
    // the port's default, which is also a plain value.
    this._clearExpressionError(portName);

    return paramValue; // Simple value, return as-is
  }

  const input = this.getInput(portName);
  if (!input) {
    return paramValue.fallback; // No input definition, use fallback
  }

  try {
    // Compile and evaluate the expression
    // Note: We pass undefined for modelScope - evaluateExpression will use the global Model
    const compiled = compileExpression(paramValue.expression);
    if (!compiled) {
      console.warn(`Expression compilation failed for ${this.name}.${portName}: ${paramValue.expression}`);
      // Guarded, not left to `_raiseExpressionError`: re-parsing the source just to name
      // the syntax error is only worth doing for an editor that will show it.
      if (this.context && this.context.editorConnection) {
        const syntax = validateExpression(paramValue.expression);
        this._raiseExpressionError(portName, `Expression error: ${syntax.error || 'could not compile expression'}`);
      }
      return paramValue.fallback;
    }
    // rethrow: runtime errors must reach the catch below so they surface as
    // editor warnings instead of being silently logged inside the evaluator.
    const result = evaluateExpression(compiled, undefined, { rethrow: true });

    // Coerce to expected type
    const coercedValue = coerceToType(result, input.type, paramValue.fallback);

    // Set up reactive subscription
    // Track both the unsubscribe function and the expression string
    // If expression changes, we need to re-subscribe with new dependencies
    const currentSub = this._expressionSubscriptions[portName];
    const expressionChanged = currentSub && currentSub.expression !== paramValue.expression;

    // Unsubscribe if expression changed
    if (expressionChanged && currentSub.unsub) {
      currentSub.unsub();
      delete this._expressionSubscriptions[portName];
    }

    // Subscribe if not subscribed or expression changed
    if (!this._expressionSubscriptions[portName]) {
      const dependencies = detectDependencies(paramValue.expression);
      const hasDependencies =
        dependencies.variables.length > 0 || dependencies.objects.length > 0 || dependencies.arrays.length > 0;

      if (hasDependencies) {
        // Subscribe to changes - when a dependency changes, re-queue the input
        // Note: We store the expression string to detect changes later
        const unsub = subscribeToChanges(
          dependencies,
          function (this: RuntimeNode) {
            // Don't re-evaluate if node is deleted
            if (this._deleted) return;

            // Re-queue the expression parameter - it will be re-evaluated
            // Use the stored input value which has the current expression
            const currentValue = this._inputValues[portName];
            if (isExpressionParameter(currentValue)) {
              this.queueInput(portName, currentValue);
            }
          }.bind(this)
        );

        this._expressionSubscriptions[portName] = {
          unsub: unsub,
          expression: paramValue.expression
        };
      }
    }

    // Clear any previous expression errors
    this._clearExpressionError(portName);

    return coercedValue;
  } catch (error) {
    // Expression evaluation failed
    console.warn(`Expression evaluation failed for ${this.name}.${portName}:`, error);

    // Show warning in editor
    this._raiseExpressionError(portName, `Expression error: ${(error as Error).message}`);

    // Return fallback value
    return paramValue.fallback;
  }
};

Node.prototype.setInputValue = function (name, value) {
  const input = this.getInput(name);
  if (!input) {
    console.log("node doesn't have input", name, 'for node:', this.name);
    return;
  }

  //inputs with units always expect objects in the shape of {value, unit, ...}
  //these inputs might sometimes get raw numbers without units, and in those cases
  //Noodl should just update the value and not the other parameters
  const currentInputValue = this._inputValues[name] as { unit?: string } | undefined;

  if (isNaN(value as number) === false && currentInputValue && currentInputValue.unit) {
    //update the value, and keep the other parameters
    const newValue = Object.assign({}, currentInputValue); //copy it, so we don't modify the original object (e.g. it might come from a variant)
    (newValue as { value?: unknown }).value = value;
    value = newValue;
  }

  //Save the current input value. Save it before resolving color styles so delta updates on color styles work correctly
  this._inputValues[name] = value;

  // Evaluate expression parameters before further processing
  value = this._evaluateExpressionParameter(value, name);

  const inputTypeName = typeof input.type === 'string' ? input.type : input.type && input.type.name;

  if (input.type === 'color' && this.context && this.context.styles) {
    value = (this.context.styles as { resolveColor(value: unknown): unknown }).resolveColor(value);
  } else if ((inputTypeName === 'array' || inputTypeName === 'object') && typeof value === 'string') {
    // An array- or object-typed port can be written as a literal in the property panel
    // (both map to the JSON/expression code editor), and the string -> array / string ->
    // object typecasts are declared in the node library, so a string arriving here is
    // meant to be the value rather than to *be* a string. Parsing it is the whole content
    // of those typecasts; without this an object port silently ignored what was typed.
    //
    // An object literal has to be parenthesised: `eval('{a:1, b:2}')` reads the braces as
    // a block and throws, and `eval('{a:1}')` quietly returns 1 (a labelled statement).
    const literal = inputTypeName === 'object' ? '(' + value + ')' : value;
    // Reporting needs both an editor to report to and a component to name it in. Guarded
    // rather than assumed: the object branch is reachable from environments the array
    // branch never was, and a missing editor connection must not turn a bad literal into a
    // thrown TypeError.
    const canReport = !!(this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner);
    const warningKey = 'invalid-' + inputTypeName + '-' + name;
    try {
      value = eval(literal);
      if (canReport) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, warningKey);
      }
    } catch (e) {
      value = inputTypeName === 'object' ? {} : [];
      console.log(e);
      if (canReport) {
        this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, warningKey, {
          showGlobally: true,
          message: 'Invalid ' + inputTypeName + '<br>' + e.toString()
        });
      }
    }
  }
  // NOTE: the *outbound* half of the object/array <-> string typecasts is deliberately NOT
  // here. It lives in `_setValueFromConnection`, because a typecast is a contract between two
  // **declared ports** and this function is also the ordinary API for setting a parameter.
  // Applying it here converted an object handed straight to a string port, which broke two
  // tested behaviours that depend on seeing the raw value — `net.noodl.TextAccumulator`
  // naming a mis-wired object chunk (NDA-004 B1), and the `Object` node dereferencing a plain
  // object wired to `Id` (NDA-012 C3). See `_setValueFromConnection`.

  input.set.call(this, value);
};

Node.prototype.hasOutput = function (name) {
  return name in this._outputs;
};

Node.prototype.registerOutput = function (name, output) {
  if (this.hasOutput(name)) {
    throw new Error('Output property ' + name + ' already registered');
  }

  const newOutput = new OutputProperty({
    owner: this,
    getter: output.get || output.getter,
    name: name,
    type: output.type,
    onFirstConnectionAdded: output.onFirstConnectionAdded,
    onLastConnectionRemoved: output.onLastConnectionRemoved
  });

  this._outputs[name] = newOutput;
  this._outputList.push(newOutput);
};

Node.prototype.deregisterOutput = function (name) {
  if (this.hasOutput(name) === false) {
    throw new Error('Output property ' + name + " isn't registered");
  }

  const output = this._outputs[name];

  if (output.hasConnections()) {
    throw new Error('Output property ' + name + " has connections and can't be removed");
  }

  delete this._outputs[name];
  var index = this._outputList.indexOf(output);
  this._outputList.splice(index, 1);
};

Node.prototype.registerOutputs = function (outputs) {
  for (var name in outputs) {
    this.registerOutput(name, outputs[name]);
  }
};

Node.prototype.registerOutputIfNeeded = function () {
  //noop, can be overriden by subclasses
};

Node.prototype.getOutput = function (name) {
  if (this.hasOutput(name) === false) {
    throw new Error('Node ' + this.name + " doesn't have a port named " + name);
  }
  return this._outputs[name];
};

Node.prototype.connectInput = function (inputName: string, sourceNode: RuntimeNode, sourcePortName: string) {
  if (this.hasInput(inputName) === false) {
    throw new Error(
      "Invalid connection, input doesn't exist. Trying to connect from " +
        sourceNode.name +
        ' output ' +
        sourcePortName +
        ' to ' +
        this.name +
        ' input ' +
        inputName
    );
  }

  var sourcePort = sourceNode.getOutput(sourcePortName);
  sourcePort.registerConnection(this, inputName);

  if (!this._inputConnections[inputName]) {
    this._inputConnections[inputName] = [];
  }

  this._inputConnections[inputName].push(sourcePort);

  if (sourceNode._signalsSentThisUpdate[sourcePortName]) {
    this._setValueFromConnection(inputName, true);
    this._setValueFromConnection(inputName, false);
  } else {
    var outputValue = sourcePort.value;
    if (outputValue !== undefined) {
      this._setValueFromConnection(inputName, outputValue);

      if (this.context) {
        // Send value to editor for connection debugging.
        // Conceptually the value has already been sent,
        // but the editor needs to be notified after a connection is created
        this.context.connectionSentValue(sourcePort, sourcePort.value);
      }
    }
  }

  this.flagDirty();
};

Node.prototype.removeInputConnection = function (inputName: string, sourceNodeId: string, sourcePortName: string) {
  if (!this._inputConnections[inputName]) {
    throw new Error("Node removeInputConnection: Input doesn't exist");
  }

  const inputsToPort = this._inputConnections[inputName];

  for (let i = 0; i < inputsToPort.length; i++) {
    const sourcePort = inputsToPort[i];
    if (sourcePort.owner.id === sourceNodeId && sourcePort.name === sourcePortName) {
      inputsToPort.splice(i, 1);

      //remove the output from the source node
      const output = sourcePort.owner.getOutput(sourcePortName);
      output.deregisterConnection(this, inputName);
      break;
    }
  }

  if (inputsToPort.length === 0) {
    //no inputs left, remove the bookkeeping that traces values sent to this node as inputs
    delete this._valuesFromConnections[inputName];
  }
};

Node.prototype.isInputConnected = function (inputName) {
  if (!this._inputConnections.hasOwnProperty(inputName)) {
    return false;
  }

  //We have connections, but they might be from non-connected component inputs.
  // If they are from a component input then check the input on the component instance.
  return this._inputConnections[inputName].some((c) => {
    //if this is not a component input, then we have a proper connection
    if (c.owner.name !== 'Component Inputs') return true;

    //the name of the output from the component input, is the same as the component instance input
    const component = c.owner.nodeScope.componentOwner;
    return component.isInputConnected(c.name);
  });
};

Node.prototype.update = function () {
  if (this._isUpdating || this._dirty === false) {
    return;
  }

  if (this._updatedAtIteration !== this.context.updateIteration) {
    this._updatedAtIteration = this.context.updateIteration;
    this._updateIteration = 0;
    if (this._cyclicLoop) this._cyclicLoop = false;
  }

  this._isUpdating = true;
  const maxUpdateIterations = 100;

  // OBS-001: resolved once per update rather than per queue entry. Undefined — the only case
  // when nobody is tracing — is what makes the drain loop below cost nothing.
  const tracingContext = this.context && this.context.traceEnabled === true ? this.context : undefined;

  try {
    while (this._dirty && !this._cyclicLoop) {
      this._updateDependencies();

      //all inputs are now updated, flag as not dirty
      this._dirty = false;

      const inputNames = Object.keys(this._inputValuesQueue);

      let hasMoreInputs = true;

      while (hasMoreInputs && !this._cyclicLoop) {
        hasMoreInputs = false;

        for (let i = 0; i < inputNames.length; i++) {
          const inputName = inputNames[i];
          const queue = this._inputValuesQueue[inputName];
          if (queue.length > 0) {
            const queued = queue.shift();

            // OBS-001: for the duration of this input's processing, the event that delivered
            // it *is* the cause of anything this node sends. Restored afterwards rather than
            // zeroed, because a node updating inside another node's update (a component
            // instance, an after-input callback) must not erase its caller's cause.
            const causeQueue = tracingContext ? this._inputCauseQueue[inputName] : undefined;
            const previousCause = tracingContext ? tracingContext._currentCause : 0;
            if (tracingContext) {
              tracingContext._currentCause = causeQueue && causeQueue.length > 0 ? causeQueue.shift() : 0;
            }

            try {
              if (queued === SIGNAL_PULSE) {
                // Both halves in the same pass: the rising edge is the event, and the
                // falling edge only rearms the detector. Splitting them across passes is
                // what used to desynchronise a signal from the value it pairs with.
                this.setInputValue(inputName, true);
                this.setInputValue(inputName, false);
              } else {
                this.setInputValue(inputName, queued);
              }
            } finally {
              if (tracingContext) tracingContext._currentCause = previousCause;
            }

            if (queue.length > 0) {
              hasMoreInputs = true;
            }
          }
        }

        const afterInputCallbacks = this._afterInputsHaveUpdatedCallbacks;
        this._afterInputsHaveUpdatedCallbacks = [];
        for (let i = 0; i < afterInputCallbacks.length; i++) {
          afterInputCallbacks[i].call(this);
        }
      }
      this._updateIteration++;

      if (this._updateIteration >= maxUpdateIterations) {
        this._cyclicLoop = true;
        this._cyclicLoopCause = { limit: 'update-iterations', count: maxUpdateIterations };
      }
    }
  } catch (e) {
    this._isUpdating = false;
    throw e;
  }

  if (this._cyclicLoop) {
    //flag the node as dirty again to let it contiune next frame so we don't just stop it
    //This will allow the browser a chance to render and run other code
    this.context.scheduleNextFrame(() => {
      this.context.nodeIsDirty(this);
    });

    // NDA-004: reported through the runtime error channel rather than straight to
    // `editorConnection.sendWarning`, so a cycle in a deployed app is diagnosable at all. The
    // editor still shows the same message — its warning adapter is a subscriber now. The
    // `cyclicLoops` gate is kept so an author who turned this warning off still has it off.
    if (!this._cyclicWarningSent && this.context.isWarningTypeEnabled('cyclicLoops')) {
      this._cyclicWarningSent = true;
      this.raiseRuntimeError('runtime/cyclic-loop', 'Cyclic loop detected', this._cyclicLoopCause);
    }
  }

  this._isFirstUpdate = false;
  this._isUpdating = false;
};

Node.prototype._updateDependencies = function () {
  for (var inputName in this._inputConnections) {
    var connectedPorts = this._inputConnections[inputName];
    for (var i = 0; i < connectedPorts.length; ++i) {
      connectedPorts[i].owner.update();
    }
  }
};

Node.prototype.flagDirty = function () {
  if (this._dirty) {
    return;
  }

  this._dirty = true;

  //a hack to not update nodes as a component is being created.
  //Nodes should update once all connections are in place, so inputs that rely on connections, e.g. "Run" on a Function node, have the correct context before running.
  //This flag is being updated externally by the NodeScope and _performDirtyUpdate will be called when the component setup is done
  if (this.updateOnDirtyFlagging) {
    this._performDirtyUpdate();
  }
};

Node.prototype._performDirtyUpdate = function () {
  this.context && this.context.nodeIsDirty(this);

  for (var i = 0; i < this._outputList.length; ++i) {
    this._outputList[i].flagDependeesDirty();
  }
};

Node.prototype.sendValue = function (name, value) {
  if (this.hasOutput(name) === false) {
    console.log('Error: Node', this.name, "doesn't have a output named", name);
    return;
  }

  if (value === undefined) {
    return;
  }

  const output = this.getOutput(name);
  output.sendValue(value);

  if (this.context) {
    this.context.connectionSentValue(output, value);
  }
};

Node.prototype.flagOutputDirty = function (name) {
  const output = this.getOutput(name);
  this.sendValue(name, output.value);
};

Node.prototype.flagAllOutputsDirty = function () {
  for (const output of this._outputList) {
    this.sendValue(output.name, output.value);
  }
};

Node.prototype.sendSignalOnOutput = function (outputName) {
  if (this.hasOutput(outputName) === false) {
    console.log('Error: Node', this.name, "doesn't have a output named", outputName);
    return;
  }

  const output = this.getOutput(outputName);
  output.sendPulse();

  this._signalsSentThisUpdate[outputName] = true;
  this.scheduleAfterInputsHaveUpdated(function (this: RuntimeNode) {
    this._signalsSentThisUpdate[outputName] = false;
  });

  if (this.context) {
    this.context.connectionSentSignal(output);
  }
};

/**
 * Report that this node was asked to act and could not — the one way a node reports failure.
 * See `dev-docs/reference/FAILURE-CONTRACT.md`.
 *
 * Provenance is filled in here rather than at the call site: a node cannot claim to be
 * another, and every call site stays one line. `componentName` falls back rather than
 * throwing, because the conditions worth reporting include ones that happen before a node
 * has a scope — and a failure in the failure channel would be the worst possible bug.
 */
Node.prototype.raiseRuntimeError = function (code: string, message: string, detail?: unknown) {
  const context = this.context;
  if (!context || !context.errorBus) return;

  let componentName = '<unknown>';
  try {
    if (this.nodeScope && this.nodeScope.componentOwner && this.nodeScope.componentOwner.name) {
      componentName = this.nodeScope.componentOwner.name;
    }
  } catch (e) {
    /* provenance is best-effort; the event still carries nodeId and nodeType */
  }

  context.errorBus.raise({
    nodeId: this.id,
    componentName,
    nodeType: this.name,
    code,
    message,
    detail
  });
};

/**
 * Report — or withdraw — a node-local diagnostic.
 * See `dev-docs/reference/DIAGNOSTICS-CONTRACT.md`.
 *
 * Deliberately a *setter* rather than a report/clear pair: a falsy `message` means the predicate
 * does not hold and clears the key, so one call site expresses the whole predicate and a stale
 * warning is not something a caller can forget to clean up.
 *
 * The counterpart to {@link raiseRuntimeError}, and the line between them is *event vs predicate*:
 * a failure happened at a moment and belongs on the error bus, where a deployed app's operator and
 * `On App Error` can see it. A diagnostic is true continuously and is editor-only on purpose —
 * the only person who can fix "`Items` is not an array" is the author, in the editor.
 */
Node.prototype.setDiagnostic = function (key: string, message?: string | null) {
  setDiagnostic(this, key, message);
};

/**
 * Whether {@link setDiagnostic} will do anything, for a check whose *predicate* is expensive
 * enough to be worth skipping outright. Building only the message is handled by the ternary at
 * the call site; this is for the rarer case where the test itself costs something.
 */
Object.defineProperty(Node.prototype, 'diagnosticsEnabled', {
  get: function (this: RuntimeNode) {
    return diagnosticsEnabled(this);
  }
});

/**
 * Open an invocation of an action, so its outcome can be reported exactly once.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md`. Call this where the signal input is handled and
 * keep the token until the action resolves — the token, not the node, is what carries "has this
 * invocation reported yet", which is the only shape that survives an async action whose result
 * arrives several frames later.
 *
 * ⚠️ **Per-invocation, deliberately.** `Close Popup` and `Pop Component Stack` latch their first
 * result on the *node* and report it again on every later use, which is invisible to any test
 * that exercises the node once (FINDINGS **NV-iii**). A fresh token per invocation is what makes
 * that class unrepresentable rather than merely fixed.
 */
Node.prototype.beginOutcome = function () {
  return { reported: undefined };
};

/**
 * End an invocation with exactly one of `Done` / `Unchanged` / `Failure`, then `Completed`.
 *
 * @param token   from {@link beginOutcome}, for this invocation and no other
 * @param outcome the one thing that happened
 * @param options `code` and `message` are required for `failure` and ignored otherwise
 *
 * Three of the phase's most-repeated defect shapes are closed here rather than per node:
 *
 * - ⚠️ **`sendSignalOnOutput`, never `flagOutputDirty`.** On a signal output the latter sends a
 *   *value* of `undefined` rather than a pulse, which is why `Date To String`'s `Invalid Date`
 *   had never once fired (FINDINGS **SR-v**).
 * - ⚠️ **The outcome is the last thing an action does.** A signal sent before the values it
 *   describes was found in four nodes this phase; a call site that flags its outputs dirty and
 *   *then* calls this cannot get the order wrong.
 * - ⚠️ **`Unchanged` does not raise.** It is not an error, and a `Failure` that fires on a graph
 *   working exactly as written is how authors are trained to ignore the port.
 */
Node.prototype.reportOutcome = function (token, outcome, options) {
  // ERG-001 §3 — `Treat Unchanged as`, applied here so that a node adopting the setting needs
  // no code of its own beyond spreading `outcomeInputs()` into its inputs.
  //
  // ⚠️ **Written as "only these two values remap"**, never as "unless it is 'unchanged'",
  // because a declared `default` does not run its setter (FINDINGS **A-D1**) — the stored
  // value is `undefined` until an author touches the panel, and `undefined` has to mean the
  // default. This direction is the one that is correct without the setter having run.
  //
  // `Completed` is unaffected: it fires after whatever this resolves to, which is the whole
  // point of it being the one port with no exemption.
  if (outcome === 'unchanged') {
    const policy = (this._internal as Record<string, unknown>)[TREAT_UNCHANGED_AS];
    if (policy === 'done') {
      outcome = 'done';
    } else if (policy === 'failure') {
      outcome = 'failure';
      // The reason has to say it was a *configuration* choice. A bare "the action could not be
      // performed" would send an author hunting for a fault in a graph that worked exactly as
      // they told it to, which is the failure channel doing more damage than the thing it
      // reports.
      options = {
        code: 'outcome/unchanged-as-failure',
        message:
          'The action was valid and there was nothing to do, which Treat Unchanged as reports ' +
          'as a failure on this node',
        detail: options && options.detail
      };
    }
  }

  if (token.reported !== undefined) {
    // "Exactly one" is the load-bearing half of the contract, so a second report is a library
    // defect and is reported as one rather than quietly winning or quietly losing.
    this.raiseRuntimeError(
      'outcome/duplicate',
      `Reported ${token.reported} and then ${outcome} for one invocation, which the outcome contract forbids`,
      { first: token.reported, second: outcome }
    );
    return;
  }
  token.reported = outcome;

  if (outcome === 'failure' && !(options && options.raise === false)) {
    // Raised before the signal for the same reason values are flagged before it: a graph wiring
    // `failure -> show` must already be able to read the reason when the pulse lands.
    //
    // `raise: false` means the reason is already on the channel from a more precise raise
    // elsewhere — see `OutcomeFailureOptions.raise`. It suppresses the *duplicate*, never the
    // only report.
    this.raiseRuntimeError(
      (options && options.code) || 'outcome/unspecified-failure',
      (options && options.message) || 'The action could not be performed',
      options && options.detail
    );
  }

  if (this.hasOutput(outcome)) {
    this.sendSignalOnOutput(outcome);
  } else {
    this.raiseRuntimeError(
      'outcome/missing-port',
      `Reported ${outcome} but has no ${outcome} output, so the outcome reached no wire`,
      { outcome }
    );
  }

  // Universal, and the one port with no exemption — its whole value is that an author can rely
  // on it being there.
  if (this.hasOutput(COMPLETED_PORT)) {
    this.sendSignalOnOutput(COMPLETED_PORT);
  } else {
    this.raiseRuntimeError(
      'outcome/missing-completed',
      'Adopted the outcome contract without a Completed output, which every action must have',
      { outcome }
    );
  }
};

/**
 * A value arriving over a wire.
 *
 * `sourceType` is the *declared* type of the output port it came from, and it is what scopes
 * the object/array -> string typecast (PORT-TYPE-CONTRACT.md). The table describes a cast
 * between two declared ports, so all three of these must hold: the source port is declared
 * `object`/`array`, the target input is declared `string`, and the value really is an object.
 *
 * ⚠️ **Narrowed from the contract's literal wording on purpose.** It says "a non-null
 * `object`/`array` value arriving at a `string`-typed input is `JSON.stringify`ed", which is
 * phrased in terms of the *runtime shape* of the value. Implemented that way it also fires
 * for an object arriving from a `*` port and for one set directly through `setInputValue`,
 * and it broke two deliberately pinned behaviours: `net.noodl.TextAccumulator` refusing an
 * object chunk and naming the mis-wiring (NDA-004 B1), and the `Object` node dereferencing a
 * plain object wired to `Id` from a `*` output (NDA-012 C3). Both are cases the typecast
 * table never claimed. The wording is worth amending to match.
 */
Node.prototype._setValueFromConnection = function (inputName, value, sourceType, causeSeq) {
  const sourceTypeName =
    typeof sourceType === 'string' ? sourceType : sourceType && (sourceType as { name?: string }).name;

  if ((sourceTypeName === 'object' || sourceTypeName === 'array') && value !== null && typeof value === 'object') {
    const input = this._inputs[inputName];
    const targetType = input && input.type;
    const targetTypeName = typeof targetType === 'string' ? targetType : targetType && targetType.name;

    if (targetTypeName === 'string') {
      // Values with a `toString` of their own — a Date, via the long-standing date -> string
      // cast — are left alone: only values that would print "[object Object]" (or an array's
      // bare join, which looks deceptively reasonable) get the JSON treatment.
      if (Array.isArray(value) || String(value) === '[object Object]') {
        try {
          value = JSON.stringify(value);
        } catch (e) {
          // Circular structures cannot be a string; deliver '' rather than throw mid-update.
          value = '';
          if (this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner) {
            this.context.editorConnection.sendWarning(
              this.nodeScope.componentOwner.name,
              this.id,
              'unstringifiable-object-' + inputName,
              {
                showGlobally: true,
                message: 'Could not convert object to string<br>' + e.toString()
              }
            );
          }
        }
      }
    }
  }

  // OBS-003, `node/nan-input`. See `dev-docs/reference/DIAGNOSTICS-CONTRACT.md`.
  //
  // NaN is never a value anyone wired on purpose, and it is the quietest wrong value in the
  // runtime: it survives every arithmetic operation, compares false against everything
  // including itself, and reaches a layout port as a width that silently does nothing. The
  // usual source is a string that did not parse — `Number('12px')` — several hops upstream, so
  // the node that *renders* wrong is never the node that is wrong.
  //
  // `value !== value` is true for NaN and for nothing else, so the good path is one comparison
  // and no property read. The clear needs a second one, and it is behind `_nanInputs`, which
  // stays `undefined` on every node that has never seen a NaN — which is all of them.
  if (value !== value) {
    if (this._nanInputs === undefined) this._nanInputs = {};
    if (!this._nanInputs[inputName]) {
      this._nanInputs[inputName] = true;
      this.setDiagnostic(
        NAN_INPUT_KEY + inputName,
        `Input "${inputName}" received NaN — something upstream produced Not-a-Number, ` +
          'commonly text that did not parse as a number. Every value computed from it will be NaN too.'
      );
    }
  } else if (this._nanInputs !== undefined && this._nanInputs[inputName]) {
    this._nanInputs[inputName] = false;
    this.setDiagnostic(NAN_INPUT_KEY + inputName, null);
  }

  this._valuesFromConnections[inputName] = value;
  this.queueInput(inputName, value, causeSeq);
};

/**
 * A signal arriving over a connection: one queue entry for the whole pulse.
 *
 * The port settles at `false`, exactly as it did when the pulse was two separate sends,
 * so anything reading `_valuesFromConnections` sees what it always saw.
 */
Node.prototype._setPulseFromConnection = function (inputName, causeSeq) {
  this._valuesFromConnections[inputName] = false;
  this.queueInput(inputName, SIGNAL_PULSE, causeSeq);
};

Node.prototype._hasInputBeenSetFromAConnection = function (inputName) {
  return this._valuesFromConnections.hasOwnProperty(inputName);
};

Node.prototype.queueInput = function (inputName, value, causeSeq) {
  if (!this._inputValuesQueue[inputName]) {
    this._inputValuesQueue[inputName] = [];
  }

  // OBS-001. A parallel queue rather than a wrapper around `value`: the consolidation rules
  // below inspect queued values directly (`=== true`, `instanceof Object`, `.unit`), and every
  // node in the library reads what comes out of this queue. Boxing the value would change what
  // all of them see. The parallel queue is maintained in lockstep and only when tracing is on,
  // so an untraced app pays nothing.
  const tracing = causeSeq !== undefined && this.context !== undefined && this.context.traceEnabled === true;
  if (tracing && !this._inputCauseQueue[inputName]) {
    this._inputCauseQueue[inputName] = [];
  }

  //when values are queued during the very first update, make the last value overwrite previous ones
  //so a chain with multiple nodes with values that connect to each other all
  //consolidate to a single value, instead of piling up in the queue
  if (this._isFirstUpdate) {
    //signals need two values, so make sure we don't suppress the 'false' that comes directly
    //after a 'true'
    const queueValue = this._inputValuesQueue[inputName][0] as { unit?: string } | boolean | undefined;
    const isSignal = queueValue === true || queueValue === SIGNAL_PULSE; // && value === true;
    if (!isSignal) {
      //default units are set as an object {value, unit}
      //subsequent inputs can be unitless. and will will then overwrite those
      //and the node will get a value without ever getting a unit.
      //To make sure that doesn't happen, look at the value being overwritten
      //and use the unit from that before overwriting
      if (
        queueValue instanceof Object &&
        (queueValue as { unit?: string }).unit &&
        (value as unknown) instanceof Object === false
      ) {
        value = {
          value,
          unit: (queueValue as { unit?: string }).unit
        };
      }

      this._inputValuesQueue[inputName].length = 0;
      if (this._inputCauseQueue[inputName]) this._inputCauseQueue[inputName].length = 0;
    }
  }

  this._inputValuesQueue[inputName].push(value);
  if (tracing) this._inputCauseQueue[inputName].push(causeSeq);
  this.flagDirty();
};

Node.prototype.scheduleAfterInputsHaveUpdated = function (callback) {
  this._afterInputsHaveUpdatedCallbacks.push(callback);
  this.flagDirty();
};

Node.prototype.setNodeModel = function (nodeModel) {
  this.model = nodeModel;
  nodeModel.on('parameterUpdated', this._onNodeModelParameterUpdated, this);
  nodeModel.on('variantUpdated', this._onNodeModelVariantUpdated, this);

  nodeModel.on(
    'inputPortRemoved',
    (port: { name: string }) => {
      if (this.hasInput(port.name)) {
        this.deregisterInput(port.name);
      }
    },
    this
  );

  nodeModel.on(
    'outputPortRemoved',
    (port: { name: string }) => {
      if (this.hasOutput(port.name)) {
        this.deregisterOutput(port.name);
      }
    },
    this
  );
};

Node.prototype.addDeleteListener = function (listener) {
  this._deleteListeners.push(listener);
};

Node.prototype._onNodeDeleted = function () {
  if (this.model) {
    this.model.removeListenersWithRef(this);
    this.model = undefined;
  }

  this._deleted = true;

  // Clean up expression subscriptions
  for (const portName in this._expressionSubscriptions) {
    const sub = this._expressionSubscriptions[portName];
    if (sub && sub.unsub) {
      sub.unsub();
    }
  }
  this._expressionSubscriptions = {};

  // ⚠️ And take the expression errors down with the instance that raised them. Warnings are
  // keyed by node *id*, which outlives any one instance — an unmounted node with a broken
  // expression used to leave its error in the Problems panel with nothing left to fix it on.
  // It also keeps `_expressionErrorPorts` honest: because nothing survives the instance, a
  // fresh instance starting with an empty marker is starting with an empty warning list too,
  // which is what lets `_clearExpressionError` trust the marker instead of always clearing.
  for (const portName in this._expressionErrorPorts) {
    this._clearExpressionError(portName);
  }

  for (const deleteListener of this._deleteListeners) {
    deleteListener.call(this);
  }
};

Node.prototype._onNodeModelParameterUpdated = function (event: NodeModelParameterUpdatedEvent) {
  this.registerInputIfNeeded(event.name);

  if (event.value !== undefined) {
    if (event.state) {
      //this parameter is only used in a certain visual state
      //make sure we are in that state before setting it

      if (!this._getVisualStates) {
        console.log('Node has nos visual states, but got a parameter for state', event.state);
        return;
      }

      const states = this._getVisualStates();
      if (states.indexOf(event.state) !== -1) {
        this.queueInput(event.name, event.value);
      }
    } else {
      this.queueInput(event.name, event.value);
    }
  } else {
    //parameter is undefined, that means it has been removed and we should reset to default
    let defaultValue;

    const variant = this.variant;

    if (event.state) {
      //local value has been reset, check the variant first
      if (
        variant &&
        variant.stateParameters.hasOwnProperty(event.state) &&
        variant.stateParameters[event.state].hasOwnProperty(event.name)
      ) {
        defaultValue = variant.stateParameters[event.state][event.name];
      }
      //and if variant has no value in that state, check for local values in the neutral state
      else if (this.model.parameters.hasOwnProperty(event.name)) {
        defaultValue = this.model.parameters[event.name];
      }
      //and then look in the variant neutral values
      else if (variant && variant.parameters.hasOwnProperty(event.name)) {
        defaultValue = variant.parameters[event.name];
      }
    } else if (variant && variant.parameters.hasOwnProperty(event.name)) {
      defaultValue = variant.parameters[event.name];
    }

    if (defaultValue === undefined) {
      //get the default value for the port
      defaultValue = this.context.getDefaultValueForInput(this.model.type, event.name);

      //when a paramter that's used by a text style is reset, Noodl will modify the original dom node, outside of React
      //React will then re-render, and should apply the values from the text style, but won't see any delta in the virtual dom,
      //even though there is a diff to the real dom.
      //to fix that, we just force React to re-render the entire node
      this._resetReactVirtualDOM && this._resetReactVirtualDOM();
    }

    this.queueInput(event.name, defaultValue);
  }
};

Node.prototype._onNodeModelVariantUpdated = function (variant: NodeVariant) {
  this.setVariant(variant);
};

export = Node;
