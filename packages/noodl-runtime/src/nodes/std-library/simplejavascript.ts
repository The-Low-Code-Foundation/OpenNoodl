import type {
  GraphModelLike,
  GraphPortModel,
  GraphNodeModel,
  InputPortDefinition,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import { runOnChangeDynamicPorts } from '../../run-on-value-change';

const JavascriptNodeParser = require('../../javascriptnodeparser');
const { logJavaScriptNodeError } = require('../../utils');

/** One row of the `scriptInputs`/`scriptOutputs` proplist the author edits. */
interface ScriptPortSpec {
  id: string;
  label: string;
}

/**
 * `this` inside the Function node.
 *
 * The port set is `runtime-discovered` twice over: the author declares ports in the two
 * proplists, *and* `parseAndAddPortsFromScript` mines the script text for `Inputs.x` /
 * `Outputs.y` reads. The `in-`/`out-`/`intype-`/`outtype-` prefixes are what keep those
 * four families apart on one node.
 *
 * `outputValuesProxy` is the object user code writes to as `Outputs`. The proxy is the
 * mechanism by which an assignment in user code becomes a port write.
 */
interface SimpleJavascriptNodeInstance extends NodeInstance {
  _internal: {
    inputValues: Record<string, unknown>;
    outputValues: Record<string, unknown>;
    outputValuesProxy: Record<string, unknown>;
    /** The receiver user code sees as `this`; persists across runs. */
    _this: Record<string, unknown>;
    func?: (...args: unknown[]) => Promise<unknown>;
    /** Message of the last throw from user code, for the built-in `Error` output. */
    lastError?: string;
    /**
     * Why the last `parseScript` failed, or `undefined` if the current script compiles.
     *
     * Kept rather than reported at the point of failure: `parseScript` runs from an input
     * setter, before `Run` has been pressed, and a half-typed script is not a failure of
     * anything the author asked for yet. See `runScript`.
     */
    parseError?: string;
    /** The last compile failure already raised, so an edit-by-edit retype reports once. */
    lastReportedError?: string;
  };
  /** On the instance rather than in `_internal`. */
  runScheduled?: boolean;
  /**
   * Set by the runtime when the node is removed (declared on `RuntimeNode` in
   * `internal.d.ts`). This node reads it because user code can outlive the node — a
   * `setTimeout` or an un-removed event listener keeps running after deletion.
   */
  _deleted: boolean;
  scheduleRun(): void;
  runScript(): Promise<void>;
  setScriptInputValue(name: string, value: unknown): void;
  getScriptOutputValue(name: string): unknown;
  parseScript(script: string): ((...args: unknown[]) => Promise<unknown>) | undefined;
  _isSignalType(name: string): boolean;
}

const SimpleJavascriptNode: NodeDefinitionOptions = {
  name: 'JavaScriptFunction',
  displayNodeName: 'Function',
  docs: 'https://docs.noodl.net/nodes/javascript/function',
  category: 'CustomCode',
  color: 'javascript',
  ssr: {
    compat: 'partial',
    note: 'Runs user code server-side; code touching window/document fails there (error logged, outputs unchanged).'
  },
  nodeDoubleClickAction: {
    focusPort: 'Script'
  },
  searchTags: ['javascript'],
  exportDynamicPorts: true,
  initialize: function (this: SimpleJavascriptNodeInstance) {
    this._internal.inputValues = {};
    this._internal.outputValues = {};

    this._internal.outputValuesProxy = new Proxy(this._internal.outputValues, {
      set: (obj, prop: string, value) => {
        //a function node can continue running after it has been deleted. E.g. with timeouts or event listeners that hasn't been removed.
        //if the node is deleted, just do nothing
        if (this._deleted) {
          // Returning nothing here means the trap returns `undefined`, which is falsy — so
          // in *strict-mode* user code this assignment throws a `TypeError` rather than
          // being silently ignored, which is the opposite of the comment's intent. Same
          // shape as the `Noodl.Arrays`/`Noodl.Objects` traps slice 9 fixed (NOTES §21.4);
          // left as it stands here because the script body is compiled non-strict by
          // default, so the throw only reaches authors who opt in (NOTES §25).
          return;
        }

        //only send outputs when they change.
        //Some Noodl projects rely on this behavior, so changing it breaks backwards compability
        if (value !== this._internal.outputValues[prop]) {
          this.registerOutputIfNeeded('out-' + prop);

          this._internal.outputValues[prop] = value;
          this.flagOutputDirty('out-' + prop);
        }
        return true;
      }
    });

    this._internal._this = {};
  },
  getInspectInfo(this: SimpleJavascriptNodeInstance): InspectInfo {
    return [
      {
        type: 'value',
        value: {
          inputs: this._internal.inputValues,
          outputs: this._internal.outputValues
        }
      }
    ];
  },
  inputs: {
    scriptInputs: {
      type: {
        name: 'proplist',
        allowEditOnly: true
      },
      group: 'Script Inputs',
      description: 'Names of the values the script reads from Inputs, each becoming an input port',
      set() {
        //  ignore
      }
    },
    scriptOutputs: {
      type: {
        name: 'proplist',
        allowEditOnly: true
      },
      group: 'Script Outputs',
      description: 'Names of the values the script writes to Outputs, each becoming an output port',
      set() {
        //  ignore
      }
    },
    functionScript: {
      displayName: 'Script',
      description: 'JavaScript run when Run fires, reading Inputs.name and writing Outputs.name',
      plug: 'input',
      type: {
        name: 'string',
        allowEditOnly: true,
        codeeditor: 'javascript'
      },
      group: 'General',
      set(this: SimpleJavascriptNodeInstance, script: string) {
        if (script === undefined) {
          this._internal.func = undefined;
          // No script is not a broken script — a stale `parseError` left here would make the
          // next `Run` report a syntax error the author has already deleted.
          this._internal.parseError = undefined;
          return;
        }

        this._internal.func = this.parseScript(script);

        // ⚠️ NDA-017 §2 — the class's one surviving instance of the old guard, and this node
        // is the reason the exception exists. Every *value* input is governed by its own
        // checkbox now, so wiring `Run` no longer changes what they do. This port is not a
        // value input; it carries the script itself, and it is set at load on every Function
        // in the project. Dropping the guard here would run every `Run`-driven script once at
        // load — including the ones that POST. See the longer note on the same line in
        // `expression.ts`.
        if (!this.isInputConnected('run')) this.scheduleRun();
      }
    },
    run: {
      type: 'signal',
      displayName: 'Run',
      group: 'Actions',
      // NDA-017 §2. The old sentence described the trap as if it were a feature; it is no
      // longer true, and it was the only place the behaviour was written down at all.
      description:
        'Runs the script now. This is additional to the inputs that re-run it; untick an input under Run On Value Change to stop that one triggering a run',
      valueChangedToTrue: function (this: SimpleJavascriptNodeInstance) {
        this.scheduleRun();
      }
    }
  },
  // NDA-004 §3. This node used to be one of the ten that take a signal and emit none: a
  // Function that could not say "done" forced authors into timing hacks — a Delay node long
  // enough to probably cover an async call — because there was no way to sequence anything
  // after it. `Run` in, nothing out.
  //
  // The reserved-name problem the spec flags solves itself: every author-declared output is
  // registered as `'out-' + name` (see `registerOutputIfNeeded`), so any port name *without*
  // that prefix is unreachable from user code and cannot collide. `Outputs.success = …` in a
  // script still writes to the author's own `out-success`, untouched by these three.
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events',
      description: 'Fires once the script has finished, waiting for an async script to resolve first'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when the script threw while running, or could not be compiled at all'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'What the script went wrong with, in JavaScript\'s own words',
      // A bare Failure signal reproduces "no information" one level up, so the message
      // travels with it (FAILURE-CONTRACT.md).
      getter: function (this: SimpleJavascriptNodeInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    scheduleRun: function (this: SimpleJavascriptNodeInstance) {
      if (this.runScheduled) return;
      this.runScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.runScheduled = false;

        if (!this._deleted) {
          this.runScript();
        }
      });
    },
    runScript: async function (this: SimpleJavascriptNodeInstance) {
      const func = this._internal.func;

      /**
       * NDA-012 (CustomCode). NDA-004 §3 gave this node `Success`/`Failure`/`Error` for the
       * case where user code *throws*, and left the case where it does not compile exactly as
       * it was: `parseScript` swallowed the `SyntaxError` into a `console.log`, returned
       * `undefined`, and `Run` then returned here without a sound. Neither signal fired, so a
       * graph sequenced behind a Function with one stray bracket stopped dead, and the only
       * diagnosis was `js-function-parse-waring` — `sendWarning`, and therefore editor-only.
       *
       * This is the same defect the Expression node had and the same fix
       * (`expression.ts:189-196`): the two nodes are the library's two script hosts and had
       * no reason to differ.
       *
       * The `parseError` guard keeps `Run` before any script has been written silent, which
       * is the state a freshly dropped node is in.
       */
      if (func === undefined) {
        const parseError = this._internal.parseError;
        if (parseError !== undefined) {
          this._internal.lastError = parseError;
          this.flagOutputDirty('error');
          // Deduplicated by message, exactly as `expression.ts:160-170` does and for the same
          // reason: with `Run` unconnected the node re-runs on every script edit, so an author
          // mid-keystroke would otherwise raise one event per character typed.
          if (this._internal.lastReportedError !== parseError) {
            this._internal.lastReportedError = parseError;
            this.raiseRuntimeError('function/script-not-compiled', 'The script could not be compiled: ' + parseError, {
              error: parseError
            });
          }
          this.sendSignalOnOutput('failure');
        }
        return;
      }

      const inputs = this._internal.inputValues;
      const outputs = this._internal.outputValuesProxy;

      // Prepare send signal functions
      for (const key in this.model.outputPorts) {
        if (this._isSignalType(key)) {
          const _sendSignal = () => {
            if (this.hasOutput(key)) this.sendSignalOnOutput(key);
          };
          // The value is both callable and carries `.send`, so user code may write either
          // `Outputs.done()` or `Outputs.done.send()`. Typed at the point the second shape
          // is attached rather than by widening the whole record to `any`.
          const signalValue = _sendSignal as typeof _sendSignal & { send: typeof _sendSignal };
          signalValue.send = _sendSignal;
          this._internal.outputValues[key.substring('out-'.length)] = signalValue;
        }
      }

      // Create Noodl API and augment with Inputs/Outputs for backward compatibility
      // Legacy code used: Noodl.Outputs.foo = 'bar'
      // New code uses: Outputs.foo = 'bar' (direct parameter)
      const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.nodeScope.modelScope);
      noodlAPI.Inputs = inputs;
      noodlAPI.Outputs = outputs;

      try {
        await func.apply(this._internal._this, [
          inputs,
          outputs,
          noodlAPI,
          JavascriptNodeParser.getComponentScopeForNode(this)
        ]);

        // `await`ed, so an `async` script signals when it has actually finished rather than
        // when it was started. That is the whole point of the port: sequencing after an
        // async Function used to require guessing a delay.
        if (!this._deleted) this.sendSignalOnOutput('success');
      } catch (e) {
        logJavaScriptNodeError(e);

        // The editor warning is kept exactly as it was — it carries the stack, which the
        // structured channel deliberately does not — and the failure is *also* raised, so a
        // throwing Function is diagnosable in a deployed app instead of vanishing.
        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          this.context.editorConnection.sendWarning(
            this.nodeScope.componentOwner.name,
            this.id,
            'js-function-run-waring',
            {
              showGlobally: true,
              message: e.message,
              stack: e.stack
            }
          );
        }

        if (this._deleted) return;

        this._internal.lastError = e && e.message ? String(e.message) : String(e);
        this.raiseRuntimeError('function/script-threw', 'The script threw: ' + this._internal.lastError, {
          error: this._internal.lastError
        });

        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    },
    setScriptInputValue: function (this: SimpleJavascriptNodeInstance, name: string, value: unknown) {
      this._internal.inputValues[name] = value;

      // NDA-017 §2. Was `if (!this.isInputConnected('run'))`. §0 measured this node
      // re-publishing the previous cycle's answer under exactly the conditions the community
      // reporter described, which mattered because their stated workaround was to abandon
      // Expression *for* this node — so the workaround bought nothing. The checkbox is named
      // for the port (`in-<name>`), not the script variable, because that is what the author
      // sees in the panel and what `registerRunOnValueChangeInput` mints.
      if (this.shouldRunOnValueChange('in-' + name)) this.scheduleRun();
    },
    getScriptOutputValue: function (this: SimpleJavascriptNodeInstance, name: string) {
      if (this._isSignalType(name)) {
        return undefined;
      }
      return this._internal.outputValues[name];
    },
    // These two write to `_internal.inputTypes` / `_internal.outputTypes`, and neither
    // container is ever created — `initialize` above sets only `inputValues`,
    // `outputValues`, `outputValuesProxy` and `_this`. Both would therefore throw
    // `TypeError: Cannot set properties of undefined` if reached, the same shape as the
    // Globals node's `_cachedInputValues`. Nothing in the repo calls either, so they are
    // dead rather than broken. Kept verbatim (PLAT-003 NOTES §25).
    setScriptInputType: function (this: SimpleJavascriptNodeInstance, name: string, type: unknown) {
      (this._internal as unknown as { inputTypes: Record<string, unknown> }).inputTypes[name] = type;
    },
    setScriptOutputType: function (this: SimpleJavascriptNodeInstance, name: string, type: unknown) {
      (this._internal as unknown as { outputTypes: Record<string, unknown> }).outputTypes[name] = type;
    },
    parseScript: function (this: SimpleJavascriptNodeInstance, script: string) {
      let func;
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        func = new AsyncFunction(
          'Inputs',
          'Outputs',
          'Noodl',
          'Component',
          JavascriptNodeParser.getCodePrefix() + script
        );
        this._internal.parseError = undefined;
        // A script that compiles re-arms the report, so a syntax error reintroduced later is
        // heard again rather than suppressed for the life of the node.
        this._internal.lastReportedError = undefined;
      } catch (e) {
        console.log('Error while parsing action script: ' + e);
        // NDA-012: kept for `runScript`, which is where an author asking the node to do
        // something can be told it cannot. See the note there.
        this._internal.parseError = e && e.message ? String(e.message) : String(e);
      }

      return func;
    },
    _isSignalType: function (this: SimpleJavascriptNodeInstance, name: string) {
      // This will catch signals in script that may not have been delivered by the editor yet
      return this.model.outputPorts[name] && this.model.outputPorts[name].type === 'signal';
    },
    registerInputIfNeeded: function (this: SimpleJavascriptNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('in-')) {
        const n = name.substring('in-'.length);

        const input: InputPortDefinition = {
          set: this.setScriptInputValue.bind(this, n)
        };

        //make sure we register the type as well, so Noodl resolves types like color styles to an actual color
        if (this.model && this.model.parameters['intype-' + n]) {
          input.type = this.model.parameters['intype-' + n] as string;
        }

        this.registerInput(name, input);
        // NDA-017 §2. Labelled with the script variable rather than the port name: `in-` is
        // an implementation prefix and the author never typed it.
        this.registerRunOnValueChangeInput(name, n);
      }

      if (name.startsWith('intype-')) {
        const n = name.substring('intype-'.length);

        this.registerInput(name, {
          set(this: SimpleJavascriptNodeInstance, value: unknown) {
            // Both of these are missing the hyphen: the value port is registered as
            // `'in-' + n` a few lines above, so `'in' + n` matches nothing and this
            // branch has never applied a type. The effect is that changing an input's
            // Type after the port exists does not retype it — the type set at
            // registration time (from `parameters['intype-…']`) is the one that sticks,
            // which is why this rarely shows. Kept verbatim (PLAT-003 NOTES §25).
            if (this.hasInput('in' + n)) {
              this.getInput('in' + n).type = value as string;
            }
          }
        });
      }

      if (name.startsWith('outtype-')) {
        this.registerInput(name, {
          set() {} // Ignore
        });
      }
    },
    registerOutputIfNeeded: function (this: SimpleJavascriptNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('out-'))
        return this.registerOutput(name, {
          getter: this.getScriptOutputValue.bind(this, name.substring('out-'.length))
        });
    }
  }
};

function _parseScriptForErrorsAndPorts(
  script: string | undefined,
  name: string,
  node: GraphNodeModel,
  context: NodeContextLike,
  ports: Record<string, unknown>[]
) {
  // Clear run warnings if the script is edited
  context.editorConnection.clearWarning(node.component.name, node.id, 'js-function-run-waring');

  if (script === undefined) {
    context.editorConnection.clearWarning(node.component.name, node.id, 'js-function-parse-waring');
    return;
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', script);

    context.editorConnection.clearWarning(node.component.name, node.id, 'js-function-parse-waring');
  } catch (e) {
    context.editorConnection.sendWarning(node.component.name, node.id, 'js-function-parse-waring', {
      showGlobally: true,
      message: e.message
    });
  }

  JavascriptNodeParser.parseAndAddPortsFromScript(script, ports, {
    inputPrefix: 'in-',
    outputPrefix: 'out-'
  });
}

const inputTypeEnums = [
  {
    value: 'string',
    label: 'String'
  },
  {
    value: 'boolean',
    label: 'Boolean'
  },
  {
    value: 'number',
    label: 'Number'
  },
  {
    value: 'object',
    label: 'Object'
  },
  {
    value: 'date',
    label: 'Date'
  },
  {
    value: 'array',
    label: 'Array'
  },
  {
    value: 'color',
    label: 'Color'
  }
];

const SimpleJavascriptNodeModule: NodeModule = {
  node: SimpleJavascriptNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports: Record<string, unknown>[] = [];

        const _outputTypeEnums = inputTypeEnums.concat([
          {
            value: 'signal',
            label: 'Signal'
          }
        ]);

        // Outputs
        const scriptOutputs = node.parameters['scriptOutputs'] as ScriptPortSpec[] | undefined;
        if (scriptOutputs !== undefined && scriptOutputs.length > 0) {
          scriptOutputs.forEach((p) => {
            // Type for output
            ports.push({
              name: 'outtype-' + p.label,
              displayName: 'Type',
              editorName: p.label + ' | Type',
              plug: 'input',
              type: {
                name: 'enum',
                enums: _outputTypeEnums,
                allowEditOnly: true
              },
              default: 'string',
              parent: 'scriptOutputs',
              parentItemId: p.id
            });

            // Value for output
            ports.push({
              name: 'out-' + p.label,
              displayName: p.label,
              plug: 'output',
              type: (node.parameters['outtype-' + p.label] as string) || '*',
              group: 'Outputs'
            });
          });
        }

        // Inputs
        const scriptInputs = node.parameters['scriptInputs'] as ScriptPortSpec[] | undefined;
        if (scriptInputs !== undefined && scriptInputs.length > 0) {
          scriptInputs.forEach((p) => {
            // Type for input
            ports.push({
              name: 'intype-' + p.label,
              displayName: 'Type',
              editorName: p.label + ' | Type',
              plug: 'input',
              type: {
                name: 'enum',
                enums: inputTypeEnums,
                allowEditOnly: true
              },
              default: 'string',
              parent: 'scriptInputs',
              parentItemId: p.id
            });

            // Default Value for input
            ports.push({
              name: 'in-' + p.label,
              displayName: p.label,
              plug: 'input',
              type: (node.parameters['intype-' + p.label] as string) || 'string',
              group: 'Inputs'
            });
          });
        }

        _parseScriptForErrorsAndPorts(
          node.parameters['functionScript'] as string | undefined,
          'Script ',
          node,
          context,
          ports
        );

        // Push output ports that are signals directly to the model, it's needed by the initial run of
        // the script function
        ports.forEach((p) => {
          if (p.type === 'signal' && p.plug === 'output') {
            node.outputPorts[p.name as string] = p as unknown as GraphPortModel;
          }
        });

        // NDA-017 §2. Derived from the assembled list rather than from `scriptInputs`,
        // because a Function's inputs arrive by two routes — the proplist above and
        // `parseAndAddPortsFromScript` reading `Inputs.x` out of the script — and a checkbox
        // that only covered the first would be missing on exactly the ports an author added
        // by typing.
        const valueInputNames: string[] = [];
        const valueInputLabels: Record<string, string> = {};
        ports.forEach((p) => {
          const portName = p.name as string;
          if (p.plug !== 'input' || !portName.startsWith('in-')) return;
          if (valueInputNames.indexOf(portName) !== -1) return;
          valueInputNames.push(portName);
          valueInputLabels[portName] = portName.substring('in-'.length);
        });

        context.editorConnection.sendDynamicPorts(
          node.id,
          ports.concat(runOnChangeDynamicPorts(valueInputNames, valueInputLabels))
        );
      }

      _updatePorts();
      node.on('parameterUpdated', function () {
        _updatePorts();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.JavaScriptFunction', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('JavaScriptFunction')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = SimpleJavascriptNodeModule;
