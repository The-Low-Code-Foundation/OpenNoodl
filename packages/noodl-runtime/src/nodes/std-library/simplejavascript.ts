import type {
  GraphModelLike,
  GraphPortModel,
  GraphNodeModel,
  InputPortDefinition,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';

import { ARITHMETIC_SEARCH_TAGS } from './logic-search-tags';

import { outcomeOutputs, reportOutcomes } from '../../outcome';
import { runOnChangeDynamicPorts } from '../../run-on-value-change';
import {
  declaredOutputPorts,
  hintForThrownError,
  noOutputWrittenMessage,
  runtimeErrorMessage,
  userPositionForError
} from './functionDiagnostics';

const JavascriptNodeParser = require('../../javascriptnodeparser');
const { logJavaScriptNodeError } = require('../../utils');

/** One row of the `scriptInputs`/`scriptOutputs` proplist the author edits. */
interface ScriptPortSpec {
  id: string;
  label: string;
}

/**
 * The editor warning a throw from user code raises.
 *
 * ⚠️ The spelling is a typo that shipped, and the key is the identity the editor clears by —
 * correcting it here without correcting every `clearWarning` would strand the old warning on
 * the canvas forever. Named once so the pair cannot drift.
 */
const RUN_WARNING_KEY = 'js-function-run-waring';

/** FUN-007 §1 — "the script ran and nothing came out". A *different* key, so it clears alone. */
const NO_OUTPUT_WARNING_KEY = 'js-function-no-output-written';

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
    /**
     * FUN-007 §1 — the author-visible names of every output touched by the current run.
     *
     * Reset immediately before the body is invoked, so it answers "did *this* run put
     * anything out" rather than "has this node ever". Written from two places, because a
     * value output is an assignment through `outputValuesProxy` and a signal output is a
     * call that never reaches the proxy's `set` trap at all.
     */
    outputWrites: Set<string>;
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
    /**
     * One token per `Run` pulse waiting on the coalescing guard — ERG-001 §4.
     *
     * ⚠️ Created lazily in `scheduleRun`, not in `initialize`.
     */
    pendingRunOutcomes?: OutcomeToken[];
  };
  /** On the instance rather than in `_internal`. */
  runScheduled?: boolean;
  /**
   * Set by the runtime when the node is removed (declared on `RuntimeNode` in
   * `internal.d.ts`). This node reads it because user code can outlive the node — a
   * `setTimeout` or an un-removed event listener keeps running after deletion.
   */
  _deleted: boolean;
  scheduleRun(token?: OutcomeToken): void;
  runScript(): Promise<void>;
  reportOutputSilence(): void;
  clearRunDiagnostics(): void;
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
  /**
   * LGC-001 §1 — Function answers the arithmetic words too, but it is the wrong
   * tool for a one-liner and deliberately ranks last of the three (the Logic
   * category in `nodelibraryexport.ts` lists it after Expression and Visual
   * Function, and a tag match takes the library's order). It still leads its own
   * name: `function` is a leading name match here and only an offset-7 match on
   * "Visual Function".
   */
  searchTags: ['javascript', ...ARITHMETIC_SEARCH_TAGS],
  exportDynamicPorts: true,
  initialize: function (this: SimpleJavascriptNodeInstance) {
    this._internal.inputValues = {};
    this._internal.outputValues = {};
    this._internal.outputWrites = new Set<string>();

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

        // FUN-007 §1. Recorded *before* the change check below, and that ordering is the
        // whole point: an author who writes `Outputs.x = 5` when `x` is already 5 has
        // written an output, even though nothing is published. Counting after the check
        // would report "this node wrote no output" at a node whose code plainly does.
        this._internal.outputWrites.add(prop);

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
        codeeditor: 'javascript',
        // FUN-009. `Inputs.Name` / `Outputs.Name`, and an unknown identifier is
        // an undefined variable. Declared rather than derived: this port is
        // called `functionScript` and the *Script* node's is `code`, so any
        // guess from the name gets these two the wrong way round.
        codenotation: 'function'
      },
      group: 'General',
      set(this: SimpleJavascriptNodeInstance, script: string) {
        // FUN-007 §2. The same reasoning as the `parseError` line below, applied to the
        // *runtime* half: an error from a body the author has already replaced accuses code
        // that no longer exists, and it is the one the reader is most likely to believe —
        // it names a real line number. The text changed, so nothing this node has been told
        // about the old text survives into the next `Run`.
        this.clearRunDiagnostics();

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
        // ERG-001 §4. Only the port mints. `scheduleRun` is also reached from the
        // `functionScript` setter at load and from every ticked `in-…` value setter, and
        // neither is an invocation.
        this.scheduleRun(this.beginOutcome());
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
    /**
     * ERG-001 §4 — `Done` is **added** and `Success` keeps its name.
     *
     * `runScript` is reached from the `Run` port, from the `functionScript` setter at load and
     * from every ticked value input; two of those three are not invocations. Renaming `Success`
     * would fire `Done` at load in every project that already exists, while `Completed` — which
     * only an invocation may emit — stayed silent. The cost, recorded rather than hidden: on the
     * port path the two co-fire.
     *
     * `Unchanged` is new and closes a dead chain: `Run` on a Function with no script yet
     * returned bare. Being asked to run a program the node does not have is not a failure of
     * anything, so it does not raise — but it is not silence either.
     */
    ...outcomeOutputs({
      done: 'Fires once a Run you triggered has finished, waiting for an async script to resolve first',
      unchanged: 'Fires when there is no script to run yet, which is what a freshly dropped Function looks like'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'What the script went wrong with, in JavaScript\'s own words',
      // A bare Failure signal reproduces "no information" one level up, so the message
      // travels with it (FAILURE-CONTRACT.md).
      getter: function (this: SimpleJavascriptNodeInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    scheduleRun: function (this: SimpleJavascriptNodeInstance, token?: OutcomeToken) {
      if (token) {
        if (!this._internal.pendingRunOutcomes) this._internal.pendingRunOutcomes = [];
        this._internal.pendingRunOutcomes.push(token);
      }

      // The guard drops the second pulse's *run* deliberately; Rule 1 is per invocation, so the
      // second pulse's outcome is already queued above.
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
      // Taken into a local before the `await`, so a second `Run` arriving mid-flight owns its
      // own batch rather than being settled by this script's answer.
      const tokens = this._internal.pendingRunOutcomes || [];
      this._internal.pendingRunOutcomes = undefined;

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
          // Deduplicated by message, exactly as `expression.ts` does and for the same reason:
          // with `Run` unconnected the node re-runs on every script edit, so an author
          // mid-keystroke would otherwise raise one event per character typed.
          if (this._internal.lastReportedError !== parseError) {
            this._internal.lastReportedError = parseError;
            this.raiseRuntimeError('function/script-not-compiled', 'The script could not be compiled: ' + parseError, {
              error: parseError
            });
          }
          // ⚠️ Settled outside the dedup, and `failure` is not pulsed twice: where there are
          // tokens `reportOutcome` owns the pulse, where there are none the value-driven
          // announcement stands.
          if (tokens.length > 0) {
            reportOutcomes(this, tokens, 'failure', {
              code: 'function/script-not-compiled',
              message: 'The script could not be compiled: ' + parseError,
              raise: false
            });
          } else {
            this.sendSignalOnOutput('failure');
          }
          return;
        }

        // ERG-001 §4. Was a bare `return`: a freshly dropped Function has no script, and `Run`
        // on it emitted nothing at all — the contract's headline dead chain. Being asked to run
        // a program the node does not have is not a failure of anything, so it does not raise.
        reportOutcomes(this, tokens, 'unchanged');
        return;
      }

      const inputs = this._internal.inputValues;
      const outputs = this._internal.outputValuesProxy;

      // Prepare send signal functions
      for (const key in this.model.outputPorts) {
        if (this._isSignalType(key)) {
          const _sendSignal = () => {
            // FUN-007 §1. `Outputs.Done()` is a *call*, so it never reaches
            // `outputValuesProxy`'s `set` trap — a Function whose only output is a signal
            // would otherwise be told it produced nothing on the very run in which it fired.
            this._internal.outputWrites.add(key.substring('out-'.length));
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

      // FUN-007 §1. Reset here rather than in `initialize`: the question is what *this* run
      // put out. Placed after the signal-preparation loop above, which writes the callable
      // stubs straight to `outputValues` rather than through the proxy and so is not a write.
      this._internal.outputWrites = new Set<string>();

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
        if (!this._deleted) {
          // FUN-007 §1/§2, in this order deliberately: the run is over, so both the previous
          // run's throw and the previous run's silence are now stale, and whatever this run
          // has to say is said before anything downstream of `Success` gets to move.
          this.reportOutputSilence();
          this.sendSignalOnOutput('success');
          reportOutcomes(this, tokens, 'done');
        }
      } catch (e) {
        logJavaScriptNodeError(e);

        const rawMessage = e && e.message ? String(e.message) : String(e);

        /**
         * FUN-007 §2 and §3.
         *
         * `position` is the throw's line **in the author's document**, which is not the line
         * the stack reports — the body is compiled inside `new AsyncFunction(...)` with a code
         * prefix in front of it. `functionDiagnostics.stackLineOffset()` measures the gap
         * instead of assuming it; `undefined` when it cannot be established, because an error
         * anchored to the wrong line accuses innocent code and is worse than no anchor.
         *
         * `hint` is FUN-004's message 1 arriving by the other route: a `ReferenceError` on a
         * name that is a port on this node is the one runtime error whose cause we know.
         */
        const position = userPositionForError(e);
        const hint = hintForThrownError(e, this.model);

        // The editor warning still carries the stack, which the structured channel
        // deliberately does not — and the failure is *also* raised, so a throwing Function is
        // diagnosable in a deployed app instead of vanishing. `line`/`column` are new and are
        // scalars on purpose: `editorconnection.activewarnings` compares payloads one level
        // deep, and a nested object there would defeat its de-duplication.
        if (this.context.editorConnection && this.context.isWarningTypeEnabled('javascriptExecution')) {
          // A throw is not silence; whichever of the two the previous run left on the node,
          // this one replaces it.
          this.context.editorConnection.clearWarning(
            this.nodeScope.componentOwner.name,
            this.id,
            NO_OUTPUT_WARNING_KEY
          );
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, RUN_WARNING_KEY, {
            showGlobally: true,
            message: runtimeErrorMessage(rawMessage, position, hint),
            stack: e.stack,
            line: position ? position.line : undefined,
            column: position ? position.column : undefined,
            hint
          });
        }

        if (this._deleted) return;

        // Unchanged, and deliberately: the `Error` output is documented as "what the script
        // went wrong with, in JavaScript's own words", and a running app may already be
        // matching on it.
        this._internal.lastError = rawMessage;
        this.flagOutputDirty('error');

        const message = 'The script threw: ' + this._internal.lastError;
        const detail = {
          error: this._internal.lastError,
          line: position ? position.line : undefined,
          column: position ? position.column : undefined,
          hint
        };
        if (tokens.length > 0) {
          reportOutcomes(this, tokens, 'failure', {
            code: 'function/script-threw',
            message,
            detail
          });
        } else {
          this.raiseRuntimeError('function/script-threw', message, detail);
          this.sendSignalOnOutput('failure');
        }
      }
    },
    /**
     * FUN-007 §1 — "this node wrote no output".
     *
     * The condition is narrower than "wrote nothing", and the narrowing is the task: a
     * Function used purely for a side effect — setting a Variable, calling an API — is
     * legitimate and common, so a node with **no output ports at all** must never warn. What
     * has no innocent reading is *ports exist, so something was meant to come out, and
     * nothing did*.
     *
     * ⚠️ A **warning**, never an error, and `showGlobally: false`. FUN-007 §4 argues it from
     * the node's side (a side-effect-only node will trip this on some run through some
     * branch, and an error state for that trains people to ignore the dot); phase 50's
     * LEG-002 reached the same conclusion from the corpus side — a diagnostic aimed at a
     * population that mostly already complies fires on the wrong people. `showGlobally` is
     * the project-wide warning count in the title bar, and an advisory that can appear on
     * every run of a legitimate node does not belong in a number people are meant to drive
     * to zero. The dot on the node, which is where the author is standing when they wonder
     * why nothing came out, does not depend on the flag.
     */
    reportOutputSilence: function (this: SimpleJavascriptNodeInstance) {
      const editorConnection = this.context.editorConnection;
      if (!editorConnection || !this.context.isWarningTypeEnabled('javascriptExecution')) return;

      const componentName = this.nodeScope.componentOwner.name;

      // The run finished, so nothing the *previous* run threw is still true.
      editorConnection.clearWarning(componentName, this.id, RUN_WARNING_KEY);

      const ports = declaredOutputPorts(this.model);
      if (ports.length === 0 || this._internal.outputWrites.size > 0) {
        editorConnection.clearWarning(componentName, this.id, NO_OUTPUT_WARNING_KEY);
        return;
      }

      editorConnection.sendWarning(componentName, this.id, NO_OUTPUT_WARNING_KEY, {
        showGlobally: false,
        level: 'warning',
        message: noOutputWrittenMessage(ports)
      });
    },
    /**
     * FUN-007 §2 — everything the node has been told about a body that no longer exists.
     *
     * Called from the `functionScript` setter, so it runs on the author's keystroke rather
     * than on the next `Run`. The `lastError` clear is guarded because the setter fires once
     * per Function node at load, and an unconditional `flagOutputDirty('error')` there would
     * publish an `undefined` down every `Error` wire in the project for nothing.
     */
    clearRunDiagnostics: function (this: SimpleJavascriptNodeInstance) {
      if (this._internal.lastError !== undefined) {
        this._internal.lastError = undefined;
        this.flagOutputDirty('error');
      }

      const editorConnection = this.context.editorConnection;
      if (!editorConnection || !this.nodeScope || !this.nodeScope.componentOwner) return;

      const componentName = this.nodeScope.componentOwner.name;
      editorConnection.clearWarning(componentName, this.id, RUN_WARNING_KEY);
      editorConnection.clearWarning(componentName, this.id, NO_OUTPUT_WARNING_KEY);
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

      if (name.startsWith('out-')) {
        const label = name.substring('out-'.length);
        // NDA-014: the author picks this output's type in the `scriptOutputs` proplist, which
        // is stored as the `outtype-<label>` parameter — the same expression the editor-side
        // port list uses below. Registering the port *without* it left every Function output
        // untyped at runtime, so the object -> string typecast (which is scoped to a wire
        // between two declared ports) could not recognise the very case the contract names:
        // "a Function `object` output wired to a Text node shows JSON".
        const declaredType = this.model && this.model.parameters && this.model.parameters['outtype-' + label];
        return this.registerOutput(name, {
          type: (declaredType as string) || '*',
          getter: this.getScriptOutputValue.bind(this, label)
        });
      }
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
  // Clear run warnings if the script is edited. FUN-007 §2 adds the silence advisory to the
  // same clear: it is a statement about a particular body having run, and the body changed.
  context.editorConnection.clearWarning(node.component.name, node.id, RUN_WARNING_KEY);
  context.editorConnection.clearWarning(node.component.name, node.id, NO_OUTPUT_WARNING_KEY);

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
