'use strict';

/**
 * Logic Builder Node
 *
 * Visual logic building using Google Blockly.
 * Allows users to create complex logic without writing JavaScript.
 *
 * The node:
 * - Stores a Blockly workspace as JSON
 * - Auto-detects inputs/outputs from blocks
 * - Generates and executes JavaScript from blocks
 * - Provides full Noodl API access (Variables, Objects, Arrays)
 */

const LogicBuilderNode = {
  name: 'Logic Builder',
  docs: 'https://docs.noodl.net/nodes/logic/logic-builder',
  displayNodeName: 'Logic Builder',
  shortDesc: 'Build logic visually with blocks',
  category: 'Logic',
  color: 'purple',
  nodeDoubleClickAction: {
    focusPort: 'workspace'
  },
  searchTags: ['blockly', 'visual', 'logic', 'blocks', 'nocode'],

  initialize: function () {
    const internal = this._internal;

    internal.workspace = ''; // Blockly workspace JSON
    internal.compiledFunction = null;
    internal.executionError = null;
    internal.inputValues = {};
    internal.outputValues = {};
  },

  methods: {
    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) {
        return;
      }

      const internal = this._internal;

      this.registerInput(name, {
        set: function (value) {
          internal.inputValues[name] = value;
          // Don't auto-execute - wait for signal inputs
        }
      });
    },

    registerOutputIfNeeded: function (name, type) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        type: type || '*',
        getter: function () {
          return this._internal.outputValues[name];
        }
      });
    },

    registerSignalInputIfNeeded: function (name) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        type: 'signal',
        valueChangedToTrue: function () {
          this._executeLogic(name);
        }
      });
    },

    registerSignalOutputIfNeeded: function (name) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        type: 'signal'
      });
    },

    _executeLogic: function (triggerSignal) {
      const internal = this._internal;

      // Compile function if needed
      if (!internal.compiledFunction && internal.workspace) {
        internal.compiledFunction = this._compileFunction();
      }

      if (!internal.compiledFunction) {
        console.warn('[Logic Builder] No logic to execute');
        return;
      }

      try {
        // Create execution context
        const context = this._createExecutionContext(triggerSignal);

        // Execute generated code
        internal.compiledFunction.call(context);

        // Update outputs
        for (const outputName in context.Outputs) {
          internal.outputValues[outputName] = context.Outputs[outputName];
          this.flagOutputDirty(outputName);
        }

        internal.executionError = null;
      } catch (error) {
        console.error('[Logic Builder] Execution error:', error);
        internal.executionError = error.message;
        this.flagOutputDirty('error');
      }
    },

    _createExecutionContext: function (triggerSignal) {
      const internal = this._internal;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      // Create context with Noodl APIs
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const JavascriptNodeParser = require('../../javascriptnodeparser');
      const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context && this.context.modelScope);

      return {
        // Inputs object
        Inputs: internal.inputValues,

        // Outputs object (writable)
        Outputs: {},

        // Noodl global APIs
        Noodl: noodlAPI,
        Variables: noodlAPI.Variables,
        Objects: noodlAPI.Objects,
        Arrays: noodlAPI.Arrays,

        // Signal sending
        sendSignalOnOutput: function (name) {
          self.sendSignalOnOutput(name);
        },

        // Convenience alias
        this: {
          sendSignalOnOutput: function (name) {
            self.sendSignalOnOutput(name);
          }
        },

        // Trigger signal name (for conditional logic)
        __triggerSignal__: triggerSignal
      };
    },

    _compileFunction: function () {
      const internal = this._internal;

      if (!internal.workspace) {
        return null;
      }

      try {
        // Generate JavaScript from Blockly workspace
        // This will be done in the editor via code generation
        // For now, we expect the 'generatedCode' parameter to be set
        const code = internal.generatedCode || '';

        if (!code) {
          console.warn('[Logic Builder] No generated code available');
          return null;
        }

        // Wrap code in a function
        // Code will have access to: Inputs, Outputs, Noodl, Variables, Objects, Arrays, sendSignalOnOutput
        const fn = new Function(code);
        return fn;
      } catch (error) {
        console.error('[Logic Builder] Failed to compile function:', error);
        return null;
      }
    }
  },

  getInspectInfo() {
    const internal = this._internal;
    if (internal.executionError) {
      return `Error: ${internal.executionError}`;
    }
    return 'Logic Builder';
  },

  inputs: {
    workspace: {
      group: 'General',
      type: {
        name: 'string',
        allowEditOnly: true
      },
      displayName: 'Workspace',
      set: function (value) {
        const internal = this._internal;
        internal.workspace = value;
        internal.compiledFunction = null; // Reset compiled function
      }
    },
    generatedCode: {
      group: 'General',
      type: 'string',
      displayName: 'Generated Code',
      set: function (value) {
        const internal = this._internal;
        internal.generatedCode = value;
        internal.compiledFunction = null; // Reset compiled function
      }
    }
  },

  outputs: {
    error: {
      group: 'Status',
      type: 'string',
      displayName: 'Error',
      getter: function () {
        return this._internal.executionError || '';
      }
    }
  }
};

/**
 * Update dynamic ports based on workspace
 */
function updatePorts(nodeId, workspace, editorConnection) {
  if (!workspace) {
    editorConnection.sendDynamicPorts(nodeId, []);
    return;
  }

  try {
    // Detect I/O from workspace
    // This imports the detectIO function from the editor
    // In the editor context, this will work; in runtime it's a no-op
    const detected = detectIOFromWorkspace(workspace);

    const ports = [];

    // Add detected inputs
    detected.inputs.forEach((input) => {
      ports.push({
        name: input.name,
        type: input.type,
        plug: 'input',
        group: 'Inputs'
      });
    });

    // Add detected outputs
    detected.outputs.forEach((output) => {
      ports.push({
        name: output.name,
        type: output.type,
        plug: 'output',
        group: 'Outputs'
      });
    });

    // Add detected signal inputs
    detected.signalInputs.forEach((signalName) => {
      ports.push({
        name: signalName,
        type: 'signal',
        plug: 'input',
        group: 'Signal Inputs'
      });
    });

    // Add detected signal outputs
    detected.signalOutputs.forEach((signalName) => {
      ports.push({
        name: signalName,
        type: 'signal',
        plug: 'output',
        group: 'Signal Outputs'
      });
    });

    editorConnection.sendDynamicPorts(nodeId, ports);
  } catch (error) {
    console.error('[Logic Builder] Failed to update ports:', error);
  }
}

/**
 * Detect I/O from workspace
 * This is a bridge function that calls the editor's IODetector
 */
function detectIOFromWorkspace() {
  // In editor context, this will be replaced with actual detection
  // For now, return empty structure
  return {
    inputs: [],
    outputs: [],
    signalInputs: [],
    signalOutputs: []
  };
}

module.exports = {
  node: LogicBuilderNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Logic Builder', function (node) {
      if (node.parameters.workspace) {
        updatePorts(node.id, node.parameters.workspace, context.editorConnection);
      }

      node.on('parameterUpdated', function (event) {
        if (event.name === 'workspace') {
          updatePorts(node.id, node.parameters.workspace, context.editorConnection);
        }
      });
    });
  }
};
