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
    /** Why `generatedCode` would not compile, or `null` when it did (or when there is none). */
    compileError: string | null;
    /** Deduplication key for the raise, so an author mid-edit gets one event, not one per keystroke. */
    lastReportedError?: string;
    /** The workspace string `io` was derived from — the memo key. */
    ioSource?: string;
    io?: DetectedIO;
  };
  _executeLogic(triggerSignal: string): void;
  _createExecutionContext(triggerSignal: string): LogicBuilderExecutionContext;
  _compileFunction(): ((...args: unknown[]) => unknown) | null;
  _fail(code: string, message: string): void;
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
  __triggerSignal__: string;
}

/**
 * Port names the node itself owns.
 *
 * A block program names its ports in free-text fields, so it can name one of these — and
 * before the list existed that collision was silent in both directions. `registerOutputIfNeeded`
 * early-returns on a port that already exists, so `set output "error"` wrote into
 * `_internal.outputValues` and then flagged the *built-in* `error` output, whose getter returns
 * the last execution error: the program's value was discarded without a word. A `Define input`
 * named `run` was published as a second `run` port and delivered a pulse where the blocks
 * expected a value.
 *
 * NDA-004 §3 named this as the cost of giving a completion signal to a node whose ports are
 * author-declared. `Function` had no such cost because every author-declared output there is
 * registered as `'out-' + name` and so cannot reach an unprefixed built-in. This node registers
 * author names verbatim — changing that would break every `generatedCode` string in every
 * existing project — so the names are reserved and the collision is reported instead.
 */
const RESERVED_INPUTS = ['workspace', 'generatedCode', 'run'];
const RESERVED_OUTPUTS = ['error', 'success', 'failure'];

const LogicBuilderNode: NodeDefinitionOptions = {
  name: 'Logic Builder',
  docs: 'https://docs.noodl.net/nodes/logic/logic-builder',
  displayNodeName: 'Logic Builder',
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
    internal.compileError = null;
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

    /**
     * Report one failure on every channel the node has: the `error` string for a graph to
     * read, the `Failure` signal for a graph to sequence on, and the runtime error channel so
     * a deployed build is diagnosable (FAILURE-CONTRACT.md). The raise is deduplicated by
     * message the way `expression.ts:160-170` and `simplejavascript.ts:255-263` are, and for
     * the same reason: an author editing blocks re-runs the node constantly.
     */
    _fail: function (this: LogicBuilderNodeInstance, code: string, message: string) {
      const internal = this._internal;

      internal.executionError = message;
      this.flagOutputDirty('error');

      if (internal.lastReportedError !== message) {
        internal.lastReportedError = message;
        this.raiseRuntimeError(code, message, { error: message });
      }

      this.sendSignalOnOutput('failure');
    },

    _executeLogic: function (this: LogicBuilderNodeInstance, triggerSignal: string) {
      const internal = this._internal;

      // Compile function if needed
      if (!internal.compiledFunction) {
        internal.compiledFunction = this._compileFunction();
      }

      if (!internal.compiledFunction) {
        /**
         * NDA-012 (CustomCode). Two different states used to share this bare `return`, and
         * only one of them is silence.
         *
         * A node with no blocks yet has nothing to run and nothing to say — that is what a
         * freshly dropped node looks like, and `Run` on it must stay quiet. A node whose
         * `generatedCode` will not *compile* is a failure, and it was reported to nobody:
         * `_compileFunction` swallowed the `SyntaxError` into a `console.error` and returned
         * `null`, so the `error` output stayed empty, no signal fired, and a graph sequenced
         * behind the node stopped dead with no diagnosis anywhere but a devtools console.
         *
         * This is the same defect, for the third time, on the library's four script hosts:
         * NDA-004 §2 fixed it on `Expression`, NDA-012 fixed it on `Function`
         * (`simplejavascript.ts:250-267`), and neither pass asked what else compiles user
         * code. `Script` is the fourth and its run path is still open.
         */
        if (internal.compileError) {
          this._fail('logic-builder/code-not-compiled', 'The blocks could not be compiled: ' + internal.compileError);
        }
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
          context.sendSignalOnOutput,
          context.__triggerSignal__
        );

        // Update outputs. Registration comes first because `flagOutputDirty` throws on an
        // unregistered port: a program that writes two outputs while only one is connected
        // would otherwise abort here and report a spurious execution error.
        let reservedName: string | null = null;

        for (const outputName in context.Outputs) {
          // A write to a name this node owns cannot land — the built-in port's own getter
          // decides what that port sends — so say so rather than dropping it. See
          // RESERVED_OUTPUTS. Reported after the loop, so the outputs that *can* land still
          // do.
          if (RESERVED_OUTPUTS.indexOf(outputName) !== -1) {
            reservedName = outputName;
            continue;
          }

          internal.outputValues[outputName] = context.Outputs[outputName];
          this.registerOutputIfNeeded(outputName);
          this.flagOutputDirty(outputName);
        }

        if (reservedName !== null) {
          this._fail(
            'logic-builder/reserved-port-name',
            '"' + reservedName + '" is one of the node\'s own output ports and cannot be set from the blocks'
          );
          return;
        }

        internal.executionError = null;
        this.flagOutputDirty('error');
        // NDA-004 §3: `Run` in, nothing out was this node's entry on the mute ten. Sent
        // last, after every output the program wrote has been flagged, so a graph sequenced
        // on `Success` reads values that are already up to date.
        this.sendSignalOnOutput('success');
      } catch (error) {
        console.error('[Logic Builder] Execution error:', error);
        // `error.message` alone left a `throw "some string"` reporting the empty string —
        // the node's only failure surface, blank, for a failure that did happen.
        this._fail(
          'logic-builder/blocks-threw',
          error && error.message ? String(error.message) : String(error)
        );
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

        // Which signal input started this run, so a program with several of them can branch
        // on it. It is delivered as the eighth parameter of the compiled function — it used
        // to be built here and then not passed, so `__triggerSignal__` read as `undefined`
        // inside every block program ever run.
        //
        // A `this.sendSignalOnOutput` alias sat here too, and could never have worked: a
        // `new Function` body is sloppy-mode and is called with no receiver, so `this` is the
        // global object, not this context. `NoodlGenerators.ts:73-82` emits the bare call and
        // `logic-builder-node.test.ts` pins that the qualified form throws.
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

      internal.compileError = null;

      const code = internal.generatedCode || '';
      if (!code) {
        // No blocks is not a failure — `compileError` stays null and `_executeLogic` stays
        // quiet.
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
          '__triggerSignal__',
          code
        );
        return fn;
      } catch (error) {
        console.error('[Logic Builder] Failed to compile function:', error);
        // Kept, so `_executeLogic` can tell "no program" from "a program that will not
        // compile". Returning `null` for both is what made a broken block program silent.
        internal.compileError = error && error.message ? String(error.message) : String(error);
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
      description:
        'The block program itself, authored in the block editor — it decides which ports this node has, so editing it adds and removes ports',
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
      description:
        'The JavaScript the block editor writes out of Logic Blocks and the runtime actually executes; it is overwritten on every block edit, so hand edits do not survive',
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
      description:
        'Runs the block program once; the blocks never run on their own, so a value arriving at an input changes nothing until this fires',
      valueChangedToTrue: function (this: LogicBuilderNodeInstance) {
        this._executeLogic('run');
      }
    }
  },

  // NDA-004 §3. `Run` in and nothing out put this node on the mute ten: a block program had
  // no way to say it had finished, so nothing could be sequenced after it and a failure was
  // visible only as a string somebody had to have thought to wire up.
  outputs: {
    success: {
      group: 'Status',
      type: 'signal',
      displayName: 'Success',
      description: 'Fires once the block program has run through without throwing and every output it wrote is up to date'
    },
    failure: {
      group: 'Status',
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the block program threw while running, or could not be compiled at all'
    },
    error: {
      group: 'Status',
      type: 'string',
      displayName: 'Error',
      description: 'What the last run went wrong with, in JavaScript\'s own words; empty once a run succeeds',
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

  // A block-declared name that collides with one of the node's own ports is dropped rather
  // than published: publishing it produced a second port with the same name, and the author
  // could then wire a value into what is really the built-in `Run` signal. The runtime raises
  // `logic-builder/reserved-port-name` when a program writes to a reserved *output*, which is
  // the half that can be detected; a program *reading* `Inputs["run"]` gets `undefined` and
  // nothing can see that it did. See RESERVED_INPUTS / RESERVED_OUTPUTS.
  for (const input of io.inputs) {
    if (RESERVED_INPUTS.indexOf(input.name) !== -1) continue;
    ports.push({
      name: input.name,
      type: input.type,
      plug: 'input',
      group: 'Inputs',
      displayName: input.name
    });
  }

  for (const output of io.outputs) {
    if (RESERVED_OUTPUTS.indexOf(output.name) !== -1) continue;
    ports.push({
      name: output.name,
      type: output.type,
      plug: 'output',
      group: 'Outputs',
      displayName: output.name
    });
  }

  for (const name of io.signalInputs) {
    if (RESERVED_INPUTS.indexOf(name) !== -1) continue;
    ports.push({
      name,
      type: 'signal',
      plug: 'input',
      group: 'Signals',
      displayName: name
    });
  }

  for (const name of io.signalOutputs) {
    if (RESERVED_OUTPUTS.indexOf(name) !== -1) continue;
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
