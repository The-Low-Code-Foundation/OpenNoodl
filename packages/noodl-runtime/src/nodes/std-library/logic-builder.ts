'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';

import { DetectedIO, detectIO, typeOfPort } from './logic-builder-io';
import {
  BlockRunRecorder,
  IDENTITY_VALUE_PROBE,
  NOOP_STATEMENT_PROBE,
  PROBE_TRIGGER_SIGNAL,
  ProbeResult,
  evaluateFragment
} from './logic-builder-probe';
import { ARITHMETIC_SEARCH_TAGS } from './logic-search-tags';

import { outcomeOutputs } from '../../outcome';
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
  _executeLogic(triggerSignal: string, token?: OutcomeToken): void;
  _createExecutionContext(triggerSignal: string): LogicBuilderExecutionContext;
  _compileFunction(): ((...args: unknown[]) => unknown) | null;
  _probeFragment(code: string): ProbeResult;
  _fail(code: string, message: string, token?: OutcomeToken): void;
  _io(): DetectedIO;
}

/**
 * The two `NodeContext` methods this node reaches for that the published `NodeContextLike`
 * does not name.
 *
 * ⚠️ Both are optional here on purpose. `NodeContextLike` is the *published* node-author
 * contract and these are internal — but this node also runs under test harnesses and under a
 * deployed viewer whose context is built from the same constructor, so the guard at the call
 * site is a real one rather than a type-system formality.
 */
interface BlockTracingContext {
  beginBlockRun?(nodeId: string): BlockRunRecorder | undefined;
  endBlockRun?(nodeId: string, recorder: BlockRunRecorder): void;
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
/**
 * ⚠️ ERG-001 §4 added `done`, `unchanged` and `completed`.
 *
 * FINDINGS **SR-ix** predicted the reserved-name cost of giving completion signals to a node
 * whose ports are author-declared, and this is where it is paid. `registerOutputIfNeeded`
 * early-returns on a port that already exists, so without this list a block program writing
 * `Outputs.done` would flag the contract's built-in signal and its own value would vanish with
 * nothing anywhere saying why. Reserved *before* the ports landed, not after.
 */
const RESERVED_OUTPUTS = ['error', 'success', 'failure', 'done', 'unchanged', 'completed'];

const LogicBuilderNode: NodeDefinitionOptions = {
  /**
   * ⚠️ **Frozen.** `name` is the type id: it is the string in every saved
   * `project.json`, in `node-catalog.json`, in `docs/node-catalog/enrichment/`,
   * in the example `code-logic-builder-greeting.json`, and it is what
   * `slugify(typeName)` turns into the docs-site page path. Renaming it is a
   * migration and phase 59 does not do one (TASKS.md, standing constraints).
   * LGC-001 §3 changes the *label* only.
   */
  name: 'Logic Builder',
  docs: 'https://docs.noodl.net/nodes/logic/logic-builder',
  /**
   * LGC-001 §3. "Logic Builder" told a beginner nothing: the test user who said
   * on camera *"I'd really like to build my functions visually"* had this node
   * in his picker the whole time and never opened it. "Visual Function" answers
   * his sentence literally, makes `function` return both this node and the
   * JavaScript one, and makes the trio read as a progression —
   * Expression (a line) → Visual Function (blocks) → Function (code).
   *
   * ⚠️ Not "Function": Richard ruled that out, the JavaScript node keeps it.
   */
  displayNodeName: 'Visual Function',
  category: 'CustomCode',
  color: 'javascript',
  nodeDoubleClickAction: {
    focusPort: 'workspace'
  },
  /**
   * LGC-001 §1 — the arithmetic vocabulary is shared with Expression and
   * Function so all three answer `multiply`; see `logic-search-tags.ts`.
   *
   * No `function` tag: the label above now *contains* the word, so `function`
   * is a name match here (rank 7, the offset of "Function" in "Visual
   * Function") and therefore already ranks below the Function node's own
   * leading match (rank 0). A tag would be dead weight.
   */
  searchTags: ['blockly', 'visual', 'logic', 'blocks', 'nocode', ...ARITHMETIC_SEARCH_TAGS],

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
              // ERG-001 §4. A block-declared signal input is an action port like `Run`, so it
              // mints too.
              this._executeLogic(name, this.beginOutcome());
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
    _fail: function (this: LogicBuilderNodeInstance, code: string, message: string, token?: OutcomeToken) {
      const internal = this._internal;

      internal.executionError = message;
      this.flagOutputDirty('error');

      if (internal.lastReportedError !== message) {
        internal.lastReportedError = message;
        this.raiseRuntimeError(code, message, { error: message });
      }

      // ⚠️ ERG-001 §4. The token settles **outside** the dedup above: the dedup is about the
      // announcement — an author editing blocks re-runs the node constantly — while Rule 1 is
      // about the invocation, so a second `Run` over the same broken program still owes its own
      // `Failure` and `Completed`. `failure` is one port doing two jobs here, so it is not
      // pulsed twice: where there is a token `reportOutcome` owns the pulse.
      if (token) {
        this.reportOutcome(token, 'failure', { code, message, raise: false });
      } else {
        this.sendSignalOnOutput('failure');
      }
    },

    _executeLogic: function (this: LogicBuilderNodeInstance, triggerSignal: string, token?: OutcomeToken) {
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
          this._fail(
            'logic-builder/code-not-compiled',
            'The blocks could not be compiled: ' + internal.compileError,
            token
          );
          return;
        }

        // ERG-001 §4. The other half of that pair — a node with no blocks yet — was the silent
        // one, and the source above says so in as many words. It is `Unchanged`: being asked to
        // run a program the node does not have is not a failure of anything and must not raise,
        // but the bare `return` was the dead chain this contract exists to close.
        if (token) this.reportOutcome(token, 'unchanged');
        return;
      }

      /**
       * LGC-003 §1 — one generated string, two probes.
       *
       * With nobody watching this is the shared identity pair and the run costs one extra
       * pair of arguments and nothing else: no allocation, no map, no accumulation. With a
       * block editor attached to *this* node, it is a recorder, and the map goes out at the
       * end of the run.
       *
       * ⚠️ **This never touches `context.traceEnabled`, `_traceOwners` or `_traceBuffer`.**
       * TALK-003 recorded that arming the shared trace switch destroys a human's in-progress
       * Provenance recording, and HUD-004 paid for an ownership set to stop it. Rather than
       * join that switch and have to be careful, block tracing declines it: it is a separate
       * per-node set on the context, so there is nothing here that *can* commandeer a
       * recording. See `NodeContext.setBlockTracing`.
       */
      const tracing = this.context as unknown as BlockTracingContext | undefined;
      const recorder: BlockRunRecorder | undefined =
        tracing && typeof tracing.beginBlockRun === 'function' ? tracing.beginBlockRun(this.id) : undefined;

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
          context.__triggerSignal__,
          recorder ? recorder.probeValue : IDENTITY_VALUE_PROBE,
          recorder ? recorder.probeStatement : NOOP_STATEMENT_PROBE
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
            '"' + reservedName + '" is one of the node\'s own output ports and cannot be set from the blocks',
            token
          );
          return;
        }

        internal.executionError = null;
        this.flagOutputDirty('error');
        // NDA-004 §3: `Run` in, nothing out was this node's entry on the mute ten. Sent
        // last, after every output the program wrote has been flagged, so a graph sequenced
        // on `Success` reads values that are already up to date.
        this.sendSignalOnOutput('success');
        // Last, after every output the program wrote has been flagged and after `Success`.
        if (token) this.reportOutcome(token, 'done');
      } catch (error) {
        console.error('[Logic Builder] Execution error:', error);
        // `error.message` alone left a `throw "some string"` reporting the empty string —
        // the node's only failure surface, blank, for a failure that did happen.
        this._fail(
          'logic-builder/blocks-threw',
          error && error.message ? String(error.message) : String(error),
          token
        );
      } finally {
        // A run that threw halfway is exactly the run whose hollow blocks are worth seeing:
        // everything below the throw did not execute, and that is the answer to "why did my
        // condition never fire". So the frame is flushed on the failure path too, and the
        // flush itself is guarded — a diagnostic that throws out of a `finally` would replace
        // the program's real error with its own.
        if (recorder && tracing && typeof tracing.endBlockRun === 'function') {
          try {
            tracing.endBlockRun(this.id, recorder);
          } catch (flushError) {
            console.error('[Logic Builder] Could not report block values:', flushError);
          }
        }
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
        //
        // ⚠️ ERG-001 §4. The reserved-name check has to be here as well as on the value side,
        // and finding that out is the whole of FINDINGS **SR-ix** repeating itself: the value
        // loop below guards `context.Outputs`, but a `send signal` block reaches
        // `registerOutputIfNeeded` through a different door. Unguarded, a block program sending
        // `done` would pulse the *contract's* completion signal — a graph told an action
        // finished when the only thing that happened is that a block fired — and
        // `registerOutputIfNeeded`'s early return would make it look like the port had been
        // created for the program. The editor already refuses to publish such a port
        // (`updatePorts` filters `io.signalOutputs`), so this closes the runtime half.
        sendSignalOnOutput: function (name: string) {
          if (RESERVED_OUTPUTS.indexOf(name) !== -1) {
            self._fail(
              'logic-builder/reserved-port-name',
              '"' + name + '" is one of the node\'s own output signals and cannot be sent from the blocks'
            );
            return;
          }
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
          /**
           * LGC-003 §1 — the ninth and tenth parameters, and the reason there is only ever one
           * generated string.
           *
           * The editor emits `__p("<blockId>", …)` around every value block and `__s("<blockId>")`
           * before every statement, always — there is no debug build and no release build, so
           * there is no class of defect that appears only when nobody is watching. What changes
           * is which functions land here: the shared identity pair, or a recorder.
           *
           * ⚠️ **Declared unconditionally, including for code generated before this existed.**
           * A `generatedCode` string saved by an older editor mentions neither name, and an
           * unused parameter costs nothing — whereas making the list conditional on the code
           * would put a `code.indexOf('__p')` on the compile path and give the runtime two
           * shapes of compiled function to reason about.
           */
          '__p',
          '__s',
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
    },

    /**
     * LGC-002 — run one block's generated fragment and say what it came to.
     *
     * ⚠️ **`Inputs` is `_internal.inputValues`, and that is the whole point.** The context is
     * built by `_createExecutionContext`, unchanged, so the fragment sees the *live* values
     * that arrived on the node's ports rather than the defaults a static analysis would
     * assume. A Do It that answers against `undefined` inputs is worse than no Do It, because
     * it answers confidently and wrongly.
     *
     * The trigger signal is {@link PROBE_TRIGGER_SIGNAL}, not `'run'`: no signal input caused
     * this, and a program branching on `__triggerSignal__` must not be told one did.
     *
     * Containment is `evaluateFragment`'s, and it is two side effects out of several — read
     * that file's note before treating this as safe.
     */
    _probeFragment: function (this: LogicBuilderNodeInstance, code: string): ProbeResult {
      let context: LogicBuilderExecutionContext;

      try {
        context = this._createExecutionContext(PROBE_TRIGGER_SIGNAL);
      } catch (error) {
        // `createNoodlAPI` reaches the model scope. A probe is a diagnostic and must report
        // its own failure rather than throwing into the socket handler that called it.
        return {
          ok: false,
          errorPhase: 'run',
          error: 'The node could not build a context to evaluate in: ' + (error && error.message ? error.message : error)
        };
      }

      return evaluateFragment(context, code);
    }
  },

  getInspectInfo(this: LogicBuilderNodeInstance): InspectInfo {
    const internal = this._internal;
    if (internal.executionError) {
      return `Error: ${internal.executionError}`;
    }
    // The label, not the type id — this string is read by a person looking at
    // the node on the canvas. LGC-001 §3.
    return 'Visual Function';
  },

  inputs: {
    /*
     * SIG-003 — `group: ''` was already an attempt at this task's complaint, and
     * it never worked twice over. `ConnectionBar` reads `p.group ? p.group :
     * 'Other'`, and the empty string is falsy, so the port landed under `Other`
     * exactly as if the line were absent. It was also a duplicate key, silently
     * overriding whatever was declared above it.
     */
    workspace: {
      group: 'General',
      type: {
        name: 'string',
        allowEditOnly: true,
        editorType: 'logic-builder-workspace'
      },
      displayName: 'Logic Blocks',
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
      group: 'Advanced', // SIG-003 — see `workspace` above; renders nothing, so it is not `General`
      // Internal storage - renders nothing in property panel
      type: {
        name: 'string',
        allowEditOnly: true,
        editorType: 'logic-builder-hidden' // Custom type that renders nothing
      },
      displayName: 'Generated Code',
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
      group: 'Actions',
      description:
        'Runs the block program once; the blocks never run on their own, so a value arriving at an input changes nothing until this fires',
      valueChangedToTrue: function (this: LogicBuilderNodeInstance) {
        // ERG-001 §4. Every route into `_executeLogic` is a signal input port, so the grep that
        // decides a rename comes out clean here — and `Success` is kept anyway. The four script
        // hosts are a documented family and `Function` and `Expression` *must* keep theirs,
        // because on them the same work is reachable from a value setter. Splitting the family
        // so one of the four says only `Done` is the per-node divergence `outcome.ts`'s docstring
        // exists to prevent. The cost is recorded rather than hidden: on this node the two
        // co-fire on every successful run.
        this._executeLogic('run', this.beginOutcome());
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
    ...outcomeOutputs({
      group: 'Status',
      done: 'Fires once a run you triggered has finished, after Success and after every output the program wrote',
      unchanged:
        'Fires when there are no blocks to run yet, which is what a freshly dropped Visual Function looks like',
      failure: 'Fires when the block program threw while running, or could not be compiled at all'
    }),
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

  /*
   * SIG-003 — a dynamic seam, and the one place the old `Signals` heading hid a
   * real distinction: both loops filed under it, so a block program's inputs and
   * its outputs arrived in the popup under one heading that said only "these are
   * signals". A signal input is an Action you cause; a signal output is an Event
   * that happened. `scripts/node-audit/port-groups.js` reads the static catalog
   * and cannot see either of these, so they are listed in its DYNAMIC_SEAMS.
   */
  for (const name of io.signalInputs) {
    if (RESERVED_INPUTS.indexOf(name) !== -1) continue;
    ports.push({
      name,
      type: 'signal',
      plug: 'input',
      group: 'Actions',
      displayName: name
    });
  }

  for (const name of io.signalOutputs) {
    if (RESERVED_OUTPUTS.indexOf(name) !== -1) continue;
    ports.push({
      name,
      type: 'signal',
      plug: 'output',
      group: 'Events',
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
