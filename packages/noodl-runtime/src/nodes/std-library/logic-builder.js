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
  category: 'CustomCode',
  color: 'javascript',
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

        // Execute generated code, passing context variables as parameters
        internal.compiledFunction(
          context.Inputs,
          context.Outputs,
          context.Noodl,
          context.Variables,
          context.Objects,
          context.Arrays,
          context.sendSignalOnOutput
        );

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

        // Create function with parameters for context variables
        // This makes Inputs, Outputs, Noodl, etc. available to the generated code
        const fn = new Function(
          'Inputs',
          'Outputs',
          'Noodl',
          'Variables',
          'Objects',
          'Arrays',
          'sendSignalOnOutput',
          code
        );
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
      type: {
        name: 'string',
        allowEditOnly: true,
        editorType: 'logic-builder-workspace'
      },
      displayName: 'Logic Blocks',
      group: '', // Empty group to avoid "Other" label
      set: function (value) {
        const internal = this._internal;
        internal.workspace = value;
        internal.compiledFunction = null; // Reset compiled function
      }
    },
    generatedCode: {
      // Internal storage - renders nothing in property panel
      type: {
        name: 'string',
        allowEditOnly: true,
        editorType: 'logic-builder-hidden' // Custom type that renders nothing
      },
      displayName: 'Generated Code',
      group: '', // Empty group
      set: function (value) {
        const internal = this._internal;
        internal.generatedCode = value;
        internal.compiledFunction = null; // Reset compiled function when code changes
      }
    },
    run: {
      type: 'signal',
      displayName: 'Run',
      group: 'Signals',
      editorName: 'hidden', // Hide from property panel - signal comes from dynamic ports
      valueChangedToTrue: function () {
        this._executeLogic('run');
      }
    }
  },

  outputs: {
    error: {
      group: 'Status',
      type: 'string',
      displayName: 'Error',
      editorName: 'hidden', // Hide from property panel
      getter: function () {
        return this._internal.executionError || '';
      }
    }
  }
};

/**
 * Update dynamic ports based on workspace
 * This function is injected by the editor's setup code
 */
let updatePortsImpl = null;

function updatePorts(nodeId, workspace, generatedCode, editorConnection) {
  if (!workspace) {
    editorConnection.sendDynamicPorts(nodeId, []);
    return;
  }

  if (updatePortsImpl) {
    updatePortsImpl(nodeId, workspace, generatedCode, editorConnection);
  } else {
    console.warn('[Logic Builder] updatePortsImpl not initialized - running in runtime mode?');
  }
}

module.exports = {
  node: LogicBuilderNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    // Inject the real updatePorts implementation
    // This is set by the editor's initialization code
    updatePortsImpl = function (nodeId, workspace, generatedCode, editorConnection) {
      console.log('[Logic Builder] updatePortsImpl called for node:', nodeId);
      console.log('[Logic Builder] Workspace length:', workspace ? workspace.length : 0);
      console.log('[Logic Builder] Generated code length:', generatedCode ? generatedCode.length : 0);

      try {
        console.log('[Logic Builder] Parsing generated code for outputs...');

        const detected = {
          inputs: [],
          outputs: [],
          signalInputs: [],
          signalOutputs: []
        };

        // Detect outputs from code like: Outputs["result"] = ...
        const outputRegex = /Outputs\["([^"]+)"\]/g;
        let match;
        while ((match = outputRegex.exec(generatedCode)) !== null) {
          const outputName = match[1];
          if (!detected.outputs.find((o) => o.name === outputName)) {
            detected.outputs.push({ name: outputName, type: '*' });
          }
        }

        console.log('[Logic Builder] Detected outputs from code:', detected.outputs);

        if (detected.outputs.length > 0) {
          console.log('[Logic Builder] Detection results:', {
            inputs: detected.inputs.length,
            outputs: detected.outputs.length,
            signalInputs: detected.signalInputs.length,
            signalOutputs: detected.signalOutputs.length
          });
          console.log('[Logic Builder] Detected outputs:', detected.outputs);

          const ports = [];

          // Add detected inputs
          detected.inputs.forEach((input) => {
            console.log('[Logic Builder] Adding input port:', input.name);
            ports.push({
              name: input.name,
              type: input.type,
              plug: 'input',
              group: 'Inputs',
              displayName: input.name
            });
          });

          // Add detected outputs
          detected.outputs.forEach((output) => {
            console.log('[Logic Builder] Adding output port:', output.name);
            ports.push({
              name: output.name,
              type: output.type,
              plug: 'output',
              group: 'Outputs',
              displayName: output.name
            });
          });

          // Add detected signal inputs
          detected.signalInputs.forEach((signalName) => {
            console.log('[Logic Builder] Adding signal input:', signalName);
            ports.push({
              name: signalName,
              type: 'signal',
              plug: 'input',
              group: 'Signal Inputs',
              displayName: signalName
            });
          });

          // Add detected signal outputs
          detected.signalOutputs.forEach((signalName) => {
            console.log('[Logic Builder] Adding signal output:', signalName);
            ports.push({
              name: signalName,
              type: 'signal',
              plug: 'output',
              group: 'Signal Outputs',
              displayName: signalName
            });
          });

          console.log('[Logic Builder] Sending', ports.length, 'ports to editor');
          editorConnection.sendDynamicPorts(nodeId, ports);
          console.log('[Logic Builder] Ports sent successfully');
        } else {
          console.warn('[Logic Builder] IODetector not available in editor context');
        }
      } catch (error) {
        console.error('[Logic Builder] Failed to update ports:', error);
        console.error('[Logic Builder] Error stack:', error.stack);
      }
    };

    graphModel.on('nodeAdded.Logic Builder', function (node) {
      console.log('[Logic Builder] Node added:', node.id);
      if (node.parameters.workspace) {
        console.log('[Logic Builder] Node has workspace, updating ports...');
        updatePorts(node.id, node.parameters.workspace, node.parameters.generatedCode, context.editorConnection);
      }

      node.on('parameterUpdated', function (event) {
        console.log('[Logic Builder] Parameter updated:', event.name, 'for node:', node.id);
        // Trigger port update when workspace OR generatedCode changes
        if (event.name === 'workspace' || event.name === 'generatedCode') {
          console.log('[Logic Builder] Triggering port update for:', event.name);
          console.log('[Logic Builder] Workspace value:', node.parameters.workspace ? 'exists' : 'empty');
          console.log('[Logic Builder] Generated code value:', node.parameters.generatedCode ? 'exists' : 'empty');
          updatePorts(node.id, node.parameters.workspace, node.parameters.generatedCode, context.editorConnection);
        }
      });
    });
  },

  // Export for editor to set the implementation
  setUpdatePortsImpl: function (impl) {
    updatePortsImpl = impl;
  }
};
