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

import { DetectedIO, detectIO, typeOfPort } from './logic-builder-io';

import EdgeTriggeredInput = require('../../edgetriggeredinput');

/**
 * `this` inside the Logic Builder node.
 *
 * The port set is `runtime-discovered`: it comes from the Blockly workspace, which is the
 * authored source of truth. `generatedCode` is the executable projection of that same
 * workspace — the runtime runs it, but never reads ports out of it.
 */
interface LogicBuilderNodeInstance extends NodeInstance {
  _internal: {
    /** Blockly workspace JSON. */
    workspace: string;
    compiledFunction: ((...args: unknown[]) => unknown) | null;
    executionError: string | null;
    inputValues: Record<string, unknown>;
    outputValues: Record<string, unknown>;
    generatedCode?: string;
    /** The workspace string `io` was derived from — the memo key. */
    ioSource?: string;
    io?: DetectedIO;
  };
  _executeLogic(triggerSignal: string): void;
  _createExecutionContext(triggerSignal: string): LogicBuilderExecutionContext;
  _compileFunction(): ((...args: unknown[]) => unknown) | null;
  _io(): DetectedIO;
}

/** What the generated code is handed as its parameters. */
interface LogicBuilderExecutionContext {
  Inputs: Record<string, unknown>;
  Outputs: Record<string, unknown>;
  Noodl: Record<string, unknown>;
  Variables: unknown;
  Objects: unknown;
  Arrays: unknown;
  sendSignalOnOutput(name: string): void;
  this: { sendSignalOnOutput(name: string): void };
  __triggerSignal__: string;
}

const LogicBuilderNode: NodeDefinitionOptions = {
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

  initialize: function (this: LogicBuilderNodeInstance) {
    const internal = this._internal;

    internal.workspace = ''; // Blockly workspace JSON
    internal.compiledFunction = null;
    internal.executionError = null;
    internal.inputValues = {};
    internal.outputValues = {};
  },

  methods: {
    /**
     * The workspace's detected ports, memoised on the workspace string.
     *
     * Reads the node model first: `registerInputIfNeeded` runs while parameters are still
     * queued, so `_internal.workspace` is often not populated yet at the moment a connection
     * asks for a port. The model always has it by then (`setNodeModel` precedes both parameter
     * application and connection setup).
     */
    _io: function (this: LogicBuilderNodeInstance): DetectedIO {
      const internal = this._internal;

      const fromModel = this.model && this.model.parameters && this.model.parameters.workspace;
      const source = (typeof fromModel === 'string' && fromModel) || internal.workspace || '';

      if (internal.ioSource !== source || !internal.io) {
        internal.ioSource = source;
        internal.io = detectIO(source);
      }

      return internal.io;
    },

    /**
     * A connection wants an input port. Signal inputs must be registered as signals — a
     * signal delivered to a value input would be stored and never run anything — so the
     * workspace decides which kind to create. Anything the workspace does not mention still
     * gets a value input, so a connection made before the blocks were written still lands.
     */
    registerInputIfNeeded: function (this: LogicBuilderNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      const internal = this._internal;
      const io = this._io();

      if (io.signalInputs.indexOf(name) !== -1) {
        // `registerInput` installs `set` verbatim and knows nothing about
        // `valueChangedToTrue` — that rewrite happens in nodedefinition, and only for ports
        // declared up front. A dynamically registered signal has to build its own
        // rising-edge setter, or the first pulse calls an undefined `set`.
        this.registerInput(name, {
          type: 'signal',
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: function (this: LogicBuilderNodeInstance) {
              this._executeLogic(name);
            }
          })
        });
        return;
      }

      this.registerInput(name, {
        type: typeOfPort(io, 'input', name),
        set: function (value: unknown) {
          internal.inputValues[name] = value;
          // Don't auto-execute - wait for signal inputs
        }
      });
    },

    registerOutputIfNeeded: function (this: LogicBuilderNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const io = this._io();

      if (io.signalOutputs.indexOf(name) !== -1) {
        this.registerOutput(name, { type: 'signal' });
        return;
      }

      this.registerOutput(name, {
        type: typeOfPort(io, 'output', name),
        getter: function (this: LogicBuilderNodeInstance) {
          return this._internal.outputValues[name];
        }
      });
    },

    _executeLogic: function (this: LogicBuilderNodeInstance, triggerSignal: string) {
      const internal = this._internal;

      // Compile function if needed
      if (!internal.compiledFunction) {
        internal.compiledFunction = this._compileFunction();
      }

      if (!internal.compiledFunction) {
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

        // Update outputs. Registration comes first because `flagOutputDirty` throws on an
        // unregistered port: a program that writes two outputs while only one is connected
        // would otherwise abort here and report a spurious execution error.
        for (const outputName in context.Outputs) {
          internal.outputValues[outputName] = context.Outputs[outputName];
          this.registerOutputIfNeeded(outputName);
          this.flagOutputDirty(outputName);
        }

        internal.executionError = null;
        this.flagOutputDirty('error');
      } catch (error) {
        console.error('[Logic Builder] Execution error:', error);
        internal.executionError = error.message;
        this.flagOutputDirty('error');
      }
    },

    _createExecutionContext: function (
      this: LogicBuilderNodeInstance,
      triggerSignal: string
    ): LogicBuilderExecutionContext {
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

        // Signal sending. Registers on demand so a `send signal` block whose output is not
        // wired up is a no-op rather than a console error.
        sendSignalOnOutput: function (name: string) {
          self.registerOutputIfNeeded(name);
          self.sendSignalOnOutput(name);
        },

        // Convenience alias
        this: {
          sendSignalOnOutput: function (name: string) {
            self.registerOutputIfNeeded(name);
            self.sendSignalOnOutput(name);
          }
        },

        // Trigger signal name (for conditional logic)
        __triggerSignal__: triggerSignal
      };
    },

    /**
     * Compile `generatedCode` — the editor's JavaScript projection of the blocks — into a
     * callable. The workspace itself is never compiled here: turning blocks into code needs
     * Blockly, which only the editor has.
     */
    _compileFunction: function (this: LogicBuilderNodeInstance) {
      const internal = this._internal;

      const code = internal.generatedCode || '';
      if (!code) {
        return null;
      }

      try {
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

  getInspectInfo(this: LogicBuilderNodeInstance): InspectInfo {
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
      set: function (this: LogicBuilderNodeInstance, value: string) {
        const internal = this._internal;
        internal.workspace = value;
        internal.compiledFunction = null; // Reset compiled function
        internal.ioSource = undefined; // Re-detect ports from the new blocks
        internal.io = undefined;
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
      set: function (this: LogicBuilderNodeInstance, value: string) {
        const internal = this._internal;
        internal.generatedCode = value;
        internal.compiledFunction = null; // Reset compiled function when code changes
      }
    },
    run: {
      type: 'signal',
      displayName: 'Run',
      group: 'Signals',
      valueChangedToTrue: function (this: LogicBuilderNodeInstance) {
        this._executeLogic('run');
      }
    }
  },

  outputs: {
    error: {
      group: 'Status',
      type: 'string',
      displayName: 'Error',
      getter: function (this: LogicBuilderNodeInstance) {
        return this._internal.executionError || '';
      }
    }
  }
};

/**
 * Publish the node's ports to the editor from its Blockly workspace.
 *
 * The workspace is the source of truth, not the generated code: code only ever mentions the
 * ports it *uses*, so scanning it could never see a declared-but-unused input, and could
 * never tell a signal from a value. `detectIO` reads the blocks themselves and is bundled
 * with the runtime, so it is reachable from here — the viewer window — which is the whole
 * reason this used to fall back to a regex (see LEARNINGS-BLOCKLY.md §1).
 */
function updatePorts(nodeId: string, workspace: string, editorConnection: EditorConnectionLike) {
  const io = detectIO(workspace);

  const ports: Record<string, unknown>[] = [];

  for (const input of io.inputs) {
    ports.push({
      name: input.name,
      type: input.type,
      plug: 'input',
      group: 'Inputs',
      displayName: input.name
    });
  }

  for (const output of io.outputs) {
    ports.push({
      name: output.name,
      type: output.type,
      plug: 'output',
      group: 'Outputs',
      displayName: output.name
    });
  }

  for (const name of io.signalInputs) {
    ports.push({
      name,
      type: 'signal',
      plug: 'input',
      group: 'Signals',
      displayName: name
    });
  }

  for (const name of io.signalOutputs) {
    ports.push({
      name,
      type: 'signal',
      plug: 'output',
      group: 'Signals',
      displayName: name
    });
  }

  // Sent unconditionally, including when empty: clearing the blocks out of a workspace has
  // to retract the ports it used to publish.
  editorConnection.sendDynamicPorts(nodeId, ports);
}

const LogicBuilderNodeModule: NodeModule = {
  node: LogicBuilderNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Logic Builder', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters.workspace as string, context.editorConnection);

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'workspace') {
          updatePorts(node.id, node.parameters.workspace as string, context.editorConnection);
        }
      });
    });
  }
};

export = LogicBuilderNodeModule;
