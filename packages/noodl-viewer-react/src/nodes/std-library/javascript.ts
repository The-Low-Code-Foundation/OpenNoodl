import { Node } from '@noodl/runtime';
import JavascriptNodeParser from '@noodl/runtime/src/javascriptnodeparser';
import { logJavaScriptNodeError } from '@noodl/runtime/src/utils';
import type {
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  PortTypeSpec
} from '@noodl/types';

import guid from '../../guid';

/*const defaultCode = "define({\n"+
"\t// The input ports of the Javascript node, name of input and type\n"+
"\tinputs:{\n"+
"\t    // ExampleInput:'number',\n"+
"\t    // Available types are 'number', 'string', 'boolean', 'color' and 'signal',\n"+
"\t    mySignal:'signal',\n"+
"\t},\n"+
"\t\n"+
"\t// The output ports of the Javascript node, name of output and type\n"+
"\toutputs:{\n"+
"\t    // ExampleOutput:'string',\n"+
"\t},\n"+
"\t\n"+
"\t// All signal inputs need their own function with the corresponding name that\n"+
"\t// will be run when a signal is received on the input.\n"+
"\tmySignal:function(inputs,outputs) {\n"+
"\t\t// ...\n"+
"\t},\n"+
"\t\n"+
"\t// This function will be called when any of the inputs have changed\n"+
"\tchange:function(inputs,outputs) {\n"+
"\t\t// ...\n"+
"\t}\n"+
"})\n";*/

/*
const defaultCode = "script({\n"+
"\t// The input ports of the Javascript node, name of input and type\n"+
"\tinputs:{\n"+
"\t    // ExampleInput:'number',\n"+
"\t    // Available types are 'number', 'string', 'boolean', 'color'\n"+
"\t    //myNumber:'number',\n"+
"\t},\n"+
"\t\n"+
"\t// The output ports of the Javascript node, name of output and type\n"+
"\toutputs:{\n"+
"\t    // ExampleOutput:'string',\n"+
"\t},\n"+
"\t\n"+
"\t// Declare signal handle functions here, each function will be \n"+
"\t// exposed as a signal input to this node.\n"+
"\tsignals:{\n"+
"\t\t// mySignal:function() {   }\n"+
"\t},\n"+
"\t\n"+
"\t// These functions will be called when the correspinding input\n"+
"\t// is changed and the new value is provided\n"+
"\tchanged:{\n"+
"\t\t// myNumber:function(value) { }\n"+
"\t},\n"+
"\t\n"+
"\t// Here you can declare any function that will then be available\n"+
"\t// in this. So you can acces the function below with this.aFunction()\n"+
"\tmethods:{\n"+
"\t\t// aFunction:function(value) { }\n"+
"\t}\n"+
"})\n";
*/

/** A function the user wrote, called with `userFunctionScope` as `this`. */
type UserFunction = (
  this: UserFunctionScope,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
  changedInputs?: Record<string, boolean>
) => void;

/** The `this` the runtime exposes to user code. Deliberately small — it is a public API. */
interface UserFunctionScope {
  createComponent(componentName: string): Promise<NodeInstance>;
  deleteComponent(component: NodeInstance): void;
  flagOutputDirty(name: string): void;
  runNextFrame(): void;
  sendSignalOnOutput(name: string): void;
}

/**
 * The parser's result. `@noodl/runtime/src/javascriptnodeparser` is still `.js`, so this
 * describes what the Script node uses rather than importing a declaration.
 */
interface ParsedScript {
  error?: string;
  setup?: UserFunction;
  /** The run function. Named `change` because it fires when any input changed. */
  change?: UserFunction;
  destroy?: UserFunction;
  definedObject?: Record<string, unknown>;
  apis: { Node: { Inputs?: unknown; Outputs?: unknown; [extra: string]: unknown } };
  getPorts(): DynamicPort[];
}

/** A port in the editor's wire format, as pushed by `sendDynamicPorts`. */
interface DynamicPort {
  name: string;
  plug: 'input' | 'output';
  type?: PortTypeSpec;
  displayName?: string;
  group?: string;
  default?: unknown;
  parent?: string;
  parentItemId?: string;
}

/** One row of a `proplist` parameter — the editor's repeatable name/id pairs. */
interface ScriptPropListItem {
  id: string;
  label: string;
}

interface JavascriptInstance extends NodeInstance {
  _internal: {
    inputValues: Record<string, unknown>;
    outputValues: Record<string, unknown>;
    outputProperties: Record<string, unknown>;
    runScheduled: boolean;
    setupScheduled: boolean;
    runNextFrameScheduled: boolean;
    isWaitingForExternalFileToLoad: boolean;
    useExternalFile: boolean;
    runFunction?: UserFunction;
    destroyFunction?: UserFunction;
    setupFunction?: UserFunction;
    definedObject?: Record<string, unknown>;
    hasParsedCode: boolean;
    changedInputs: Record<string, boolean>;
    signalScheduled: Record<string, boolean>;
    killed: boolean;
    inputQueue?: { name: string; value: unknown }[];
    userFunctionScope: UserFunctionScope;
    onFrameStart: () => void;
    runNextFrame?: boolean;
  };
  /** `Node`'s own dirty flag, cleared directly by the `update` override below. */
  _dirty: boolean;
  _onCodeParsed(parser: ParsedScript): void;
  _callRunFunction(): void;
  _callSignalFunction(name: string): void;
  _callDestroyFunction(): void;
  _callSetupFunction(): void;
}

const defaultCode = '';

const Javascript: NodeDefinitionOptions = {
  name: 'Javascript2',
  docs: 'https://docs.noodl.net/nodes/javascript/script',
  displayNodeName: 'Script',
  category: 'CustomCode',
  color: 'javascript',
  ssr: {
    compat: 'partial',
    note: 'Runs user code server-side; code touching window/document fails there (error logged, outputs unchanged).'
  },
  nodeDoubleClickAction: {
    focusPort: 'Code'
  },
  searchTags: ['javascript'],
  exportDynamicPorts: true,
  initialize: function (this: JavascriptInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.outputValues = {};
    internal.outputProperties = {};
    internal.runScheduled = false;
    internal.setupScheduled = false;
    internal.runNextFrameScheduled = false;
    internal.isWaitingForExternalFileToLoad = false;
    internal.useExternalFile = false;
    internal.runFunction = undefined;
    internal.destroyFunction = undefined;
    internal.setupFunction = undefined;
    internal.hasParsedCode = false;
    internal.changedInputs = {};
    internal.signalScheduled = {};
    internal.killed = false;
    internal.inputQueue = [];

    const self = this;
    internal.userFunctionScope = {
      createComponent(componentName: string) {
        if (componentName && componentName.length > 0 && componentName[0] !== '/') {
          componentName = '/' + componentName;
        }

        return self.nodeScope.createNode(componentName, guid());
      },
      deleteComponent(component: NodeInstance) {
        self.nodeScope.deleteNode(component);
      },
      flagOutputDirty: function (name: string) {
        if (!name) {
          throw new Error('Output port name must be specified');
        }
        self.flagOutputDirty(name);
      },
      runNextFrame: function () {
        if (internal.runNextFrameScheduled) {
          return;
        }
        internal.runNextFrameScheduled = true;
        self.context.scheduleNextFrame(function () {
          internal.runNextFrameScheduled = false;

          if (!internal.killed) {
            scheduleRun.call(self);
          }
        });
      },
      sendSignalOnOutput: function (name: string) {
        self.sendSignalOnOutput(name);
      }
    };

    internal.onFrameStart = onFrameStart.bind(this);
  },
  dynamicports: [
    {
      condition: 'useExternalFile = no OR useExternalFile NOT SET',
      inputs: ['code']
    },
    {
      condition: 'useExternalFile = yes',
      inputs: ['externalFile']
    }
  ],
  inputs: {
    scriptInputs: {
      type: {
        name: 'proplist',
        allowEditOnly: true
      },
      group: 'Script Inputs',
      description: 'Names of the values the script reads, each becoming an input port',
      set: function () {
        //  ignore
      }
    },
    scriptOutputs: {
      type: {
        name: 'proplist',
        allowEditOnly: true
      },
      group: 'Script Outputs',
      description: 'Names of the values the script writes, each becoming an output port',
      set: function () {
        //  ignore
      }
    },
    useExternalFile: {
      type: {
        name: 'enum',
        enums: [
          {
            value: 'yes',
            label: 'Yes'
          },
          {
            value: 'no',
            label: 'No'
          }
        ],
        allowEditOnly: true
      },
      default: 'no',
      displayName: 'Use External File',
      group: 'Code',
      description: 'Whether the code is loaded from File Path instead of being typed into Code',
      set: function (this: JavascriptInstance, value: string) {
        this._internal.isWaitingForExternalFileToLoad = value === 'yes';
        this._internal.useExternalFile = value === 'yes';
      }
    },
    code: {
      displayName: 'Code',
      group: 'Code',
      description: 'The script, which declares its own ports through the define API',
      type: {
        name: 'string',
        allowEditOnly: true,
        codeeditor: 'javascript',
        // FUN-009. This node declares its ports through `define({ inputs, outputs })`
        // and its handlers receive `(inputs, outputs)` — neither the Function node's
        // `Inputs.Name` nor the Expression node's bare identifiers. Declared rather
        // than derived: the port is named `code`, which carries no signal at all.
        codenotation: 'script'
      },
      default: defaultCode,
      set: function (this: JavascriptInstance, value: string) {
        if (!value) {
          return;
        }
        const self = this;
        this.scheduleAfterInputsHaveUpdated(function (this: JavascriptInstance) {
          if (this._internal.useExternalFile === false) {
            this._callDestroyFunction();
            const parser = JavascriptNodeParser.createFromCode(value, {
              node: this
            });
            self._onCodeParsed(parser);
          }
        });
      }
    },
    externalFile: {
      displayName: 'File Path',
      group: 'Code',
      description: 'Where to load the script from; used only when Use External File is Yes',
      type: {
        name: 'source',
        allowEditOnly: true
      },
      set: function (this: JavascriptInstance, url: string) {
        if (this._internal.useExternalFile === false) {
          return;
        }

        const self = this;
        JavascriptNodeParser.createFromURL(
          url,
          function (parser: ParsedScript) {
            self._internal.isWaitingForExternalFileToLoad = false;
            self._onCodeParsed(parser);
          },
          {
            node: this
          }
        );
      }
    }
  },
  prototypeExtensions: {
    _onNodeDeleted: function (this: JavascriptInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._internal.killed = true;
      this._callDestroyFunction();
    },
    update: function (this: JavascriptInstance) {
      if (this._internal.isWaitingForExternalFileToLoad === true) {
        this._dirty = false;
      } else {
        Node.prototype.update.call(this);
      }
    },
    _onCodeParsed: function (this: JavascriptInstance, parser: ParsedScript) {
      const editorConnection = this.context.editorConnection;

      if (editorConnection) {
        // `js-parse-waring` joins the list because this method can now *send* it — a node whose
        // External File starts resolving again must lose the warning that says it does not.
        for (const w of ['js-parse-waring', 'js-destroy-waring', 'js-run-waring', 'js-setup-waring']) {
          editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, w);
        }
      }

      /**
       * NDA-012 (CustomCode). This was a bare `return`, which was defensible while the only
       * way to get here with an error was a code parse the editor had already warned about.
       * It is not defensible now that `createFromURL` reports a failed load through the same
       * field: an External File that 404s used to hang the node for ever
       * (`javascriptnodeparser.js`), and un-hanging it without saying anything would only
       * convert a hang into a silence.
       *
       * The editor warning is kept as well as the raise — it is the one an author editing the
       * node sees on the canvas, and the raise is the one that exists in a deployed build.
       */
      if (parser.error) {
        if (editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'js-parse-waring', {
            showGlobally: true,
            message: parser.error
          });
        }
        this.raiseRuntimeError('script/source-failed', 'The script could not be loaded: ' + parser.error, {
          error: parser.error
        });
        return;
      }

      //register all color inputs with type 'color' to enable color resolving
      Object.keys(this.model.inputPorts).forEach((name) => {
        const type = this.model.inputPorts[name].type;
        if (type === 'color' || (type as { name?: string }).name === 'color') {
          this._internal.inputValues[name] = undefined;

          if (!this.hasInput(name)) {
            this.registerInput(name, {
              type: 'color',
              set: userInputSetter.bind(this, name)
            });
          } else {
            //input was registered before js was done parsing
            //patch it instead of creating a new one
            this.getInput(name).type = 'color';
          }
        }
      });

      Object.keys(this.model.outputPorts).forEach((name) => {
        this.registerOutputIfNeeded(name);
      });

      this._internal.setupFunction = parser.setup;
      this._internal.runFunction = parser.change; // Run function is actually called change
      this._internal.destroyFunction = parser.destroy;

      this._internal.definedObject = parser.definedObject;

      if (this._internal.setupFunction) {
        scheduleSetup.call(this);
      }

      if (this._internal.runFunction) {
        scheduleRun.call(this);
      }

      this._internal.hasParsedCode = true;

      //set all the inputs that arrived before the code was parsed
      if (this._internal.inputQueue) {
        for (const { name, value } of this._internal.inputQueue) {
          this.setInputValue(name, value);
        }

        //delete the queue, not needed anymore
        this._internal.inputQueue = undefined;
      }

      // Node API
      parser.apis.Node.Inputs = this._internal.inputValues;
      parser.apis.Node.Outputs = this._internal.outputProperties;
    },
    registerInputIfNeeded: function (this: JavascriptInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this._internal.inputValues[name] = undefined;

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    },
    registerOutputIfNeeded: function (this: JavascriptInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const self = this;

      const isSignal = _typename(this.model.outputPorts[name].type) === 'signal';

      Object.defineProperty(this._internal.outputProperties, name, {
        set: function (value) {
          if (isSignal) return; // Cannot set signal functions

          self._internal.outputValues[name] = value;
          self.flagOutputDirty(name);
        },
        get: function () {
          if (isSignal)
            return () => {
              if (self.hasOutput(name)) self.sendSignalOnOutput(name);
            };
          return self._internal.outputValues[name];
        }
      });

      this.registerOutput(name, {
        getter: userOutputGetter.bind(this, name)
      });
    },
    _callRunFunction: function (this: JavascriptInstance) {
      const internal = this._internal;
      if (!internal.runFunction || internal.killed) {
        return;
      }

      try {
        internal.runFunction.call(
          internal.userFunctionScope,
          internal.inputValues,
          internal.outputProperties,
          internal.changedInputs
        );
      } catch (e) {
        logJavaScriptNodeError(e);

        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'js-run-waring', {
            showGlobally: true,
            message: '<strong>run</strong>: ' + e.message
          });
        }
      }
    },
    _callSignalFunction: function (this: JavascriptInstance, name: string) {
      const internal = this._internal;
      if (!internal.definedObject || internal.killed) {
        return;
      }

      if (!internal.definedObject[name] || typeof internal.definedObject[name] !== 'function') {
        return;
      }

      try {
        (internal.definedObject[name] as UserFunction).call(
          internal.userFunctionScope,
          internal.inputValues,
          internal.outputProperties
        );
      } catch (e) {
        console.log(
          'Error in JS node signal function code.',
          Object.getPrototypeOf(e).constructor.name + ': ' + e.message
        );
        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'js-run-waring', {
            showGlobally: true,
            message: '<strong>run</strong>: ' + e.message
          });
        }
      }
    },
    _callDestroyFunction: function (this: JavascriptInstance) {
      const internal = this._internal;

      if (!internal.destroyFunction) {
        return;
      }

      try {
        internal.destroyFunction.call(internal.userFunctionScope, internal.inputValues, internal.outputProperties);
      } catch (e) {
        console.log('Error in JS node destroy code.', Object.getPrototypeOf(e).constructor.name + ': ' + e.message);
        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'js-destroy-waring', {
            showGlobally: true,
            message: '<strong>setup</strong>: ' + e.message
          });
        }
      }
    },
    _callSetupFunction: function (this: JavascriptInstance) {
      const internal = this._internal;
      if (!internal.setupFunction || internal.killed) {
        return;
      }

      try {
        internal.setupFunction.call(internal.userFunctionScope, internal.inputValues, internal.outputProperties);
      } catch (e) {
        console.log('Error in JS node setup code.', Object.getPrototypeOf(e).constructor.name + ': ' + e.message);
        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'js-setup-waring', {
            showGlobally: true,
            message: '<strong>setup</strong>: ' + e.message
          });
        }
      }
    }
  }
};

function scheduleSetup(this: JavascriptInstance) {
  /* jshint validthis:true */
  if (this._internal.setupScheduled) {
    return;
  }

  this._internal.setupScheduled = true;
  this.scheduleAfterInputsHaveUpdated(function (this: JavascriptInstance) {
    if (!this._internal.killed) {
      this._callSetupFunction();
      this._internal.setupScheduled = false;
    }
  });
}

function scheduleRun(this: JavascriptInstance) {
  /* jshint validthis:true */
  if (this._internal.runScheduled || this._internal.killed) {
    return;
  }

  this._internal.runScheduled = true;
  this.scheduleAfterInputsHaveUpdated(function (this: JavascriptInstance) {
    if (!this._internal.killed) {
      this._callRunFunction();
      this._internal.changedInputs = {};
      this._internal.runScheduled = false;
    }
  });
}

function scheduleSignal(this: JavascriptInstance, name: string) {
  /* jshint validthis:true */
  if (this._internal.signalScheduled[name] || this._internal.killed) {
    return;
  }

  this._internal.signalScheduled[name] = true;
  this.scheduleAfterInputsHaveUpdated(function (this: JavascriptInstance) {
    if (!this._internal.killed) {
      this._callSignalFunction(name);
      this._internal.signalScheduled[name] = false;
    }
  });
}

function onFrameStart(this: JavascriptInstance) {
  /* jshint validthis:true */
  this._internal.runNextFrame = false;
  scheduleRun.call(this);
}

function _typename(type: PortTypeSpec) {
  if (typeof type === 'string') return type;
  else return type.name;
}

function userInputSetter(this: JavascriptInstance, name: string, value: unknown) {
  /* jshint validthis:true */

  if (this._internal.hasParsedCode === true) {
    if (this.model.inputPorts[name] !== undefined && _typename(this.model.inputPorts[name].type) === 'signal') {
      // If this is a signal, call the signal function
      if (this._internal.definedObject && typeof this._internal.definedObject[name] === 'function') {
        // This is a signal input, schedule a call to the signal function
        if (value) scheduleSignal.call(this, name);
      }
    } else {
      this._internal.inputValues[name] = value;
      this._internal.changedInputs[name] = true;
      scheduleRun.call(this);
    }
  } else {
    //inputs are arriving before the code is parsed
    //queue them up and set them later to make sure signals are
    //properly recognized
    this._internal.inputQueue.push({
      name,
      value
    });
  }
}

function userOutputGetter(this: JavascriptInstance, name: string) {
  /* jshint validthis:true */
  return this._internal.outputValues[name];
}

function _parseAndSourceJavascript(
  nodeModel: GraphNodeModel,
  context: NodeContextLike,
  fn: (ports: DynamicPort[]) => void
) {
  const editorConnection = context.editorConnection;

  if (!nodeModel.parameters) {
    return;
  }

  function clearWarnings() {
    for (const w of ['js-parse-waring', 'js-destroy-waring', 'js-run-waring', 'js-setup-waring']) {
      editorConnection.clearWarning(nodeModel.component.name, nodeModel.id, w);
    }
  }

  function onCodeParsed(parser: ParsedScript) {
    if (parser.error) {
      editorConnection.sendWarning(nodeModel.component.name, nodeModel.id, 'js-parse-waring', {
        showGlobally: true,
        message: parser.error
      });
    } else {
      clearWarnings();
    }

    fn(parser.getPorts());
  }

  if (nodeModel.parameters.externalFile && nodeModel.parameters.useExternalFile === 'yes') {
    const url = nodeModel.parameters.externalFile as string;
    JavascriptNodeParser.createFromURL(url, onCodeParsed);
  } else if (nodeModel.parameters.code) {
    const parser = JavascriptNodeParser.createFromCode(nodeModel.parameters.code as string);
    onCodeParsed(parser);
  } else {
    //no code, just send empty port list
    clearWarnings();
    fn([]);
  }
}

const JavascriptModule: NodeModule = {
  node: Javascript,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports: DynamicPort[] = [];

        const _inputTypeEnums = [
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
            value: 'array',
            label: 'Array'
          }
        ];

        const _outputTypeEnums = [
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
            value: 'array',
            label: 'Array'
          },
          {
            value: 'signal',
            label: 'Signal'
          }
        ];

        const scriptOutputs = node.parameters['scriptOutputs'] as ScriptPropListItem[] | undefined;
        const scriptInputs = node.parameters['scriptInputs'] as ScriptPropListItem[] | undefined;

        // Outputs
        if (scriptOutputs !== undefined && scriptOutputs.length > 0) {
          scriptOutputs.forEach((p) => {
            // Type for output
            ports.push({
              name: 'outtype-' + p.label,
              displayName: 'Type',
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
              name: p.label,
              plug: 'output',
              type: (node.parameters['outtype-' + p.label] as PortTypeSpec) || '*',
              group: 'Outputs'
            });
          });
        }

        // Inputs
        if (scriptInputs !== undefined && scriptInputs.length > 0) {
          scriptInputs.forEach((p) => {
            // Type for input
            ports.push({
              name: 'intype-' + p.label,
              displayName: 'Type',
              plug: 'input',
              type: {
                name: 'enum',
                enums: _inputTypeEnums,
                allowEditOnly: true
              },
              default: 'string',
              parent: 'scriptInputs',
              parentItemId: p.id
            });

            // Default Value for input
            ports.push({
              name: p.label,
              plug: 'input',
              type: (node.parameters['intype-' + p.label] as PortTypeSpec) || 'string',
              group: 'Inputs'
            });
          });
        }

        _parseAndSourceJavascript(node, context, function (_ports) {
          // Merge in ports from script
          _ports.forEach((p) => {
            if (ports.find((_p) => _p.name === p.name && _p.plug === p.plug)) return; // Port already exists

            ports.push(p);
          });

          editorConnection.sendDynamicPorts(node.id, ports);
        });
      }

      _updatePorts();
      node.on('parameterUpdated', function () {
        _updatePorts();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.Javascript2', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('Javascript2')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default JavascriptModule;
