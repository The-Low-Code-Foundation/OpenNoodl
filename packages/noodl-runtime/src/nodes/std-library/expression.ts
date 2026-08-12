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

import { ARITHMETIC_SEARCH_TAGS } from './logic-search-tags';

import Node = require('../../node');
import { outcomeOutputs, reportOutcomes } from '../../outcome';
import { runOnChangeDynamicPorts } from '../../run-on-value-change';

const difference = require('lodash.difference');
const ExpressionEvaluator = require('../../expression-evaluator');

/** The Noodl globals an expression may read, as `detectDependencies` reports them. */
interface NoodlDependencies {
  variables: string[];
  objects: string[];
  arrays: string[];
}

/**
 * `this` inside the Expression node.
 *
 * The port set is `runtime-discovered` in the strongest sense: the inputs are whatever
 * identifiers appear in the user's expression text, found by {@link parsePorts}. Nothing
 * about that set is knowable statically, which is why the catalog records the mechanism
 * rather than the ports.
 *
 * `scope` holds the current value of each such input by name; `inputNames`/`inputValues`
 * are the same data flattened into positional arrays, because the compiled function takes
 * its inputs as ordered arguments.
 */
interface ExpressionNodeInstance extends NodeInstance {
  _internal: {
    scope: Record<string, unknown>;
    hasScheduledEvaluation: boolean;
    code?: string;
    cachedValue: unknown;
    /**
     * NDA-017 §2 constraint 4. False until the node has produced a real answer, and what
     * makes `null` distinguishable from a legitimately-null result.
     */
    hasEvaluated: boolean;
    /**
     * Whether any discovered input has ever delivered a value.
     *
     * Gates *automatic* evaluation — the `expression` setter at load, and a Noodl global
     * moving. An explicit `Run` is never gated: the author asked.
     *
     * ⚠️ This exists because of a regression the §2 seed change caused and the NDA-004 §2
     * corpus caught. With inputs seeded to `undefined` rather than `0`, an expression like
     * `a.missing.deeper` *throws at load* — before anything has arrived — and
     * `_reportFailure` duly raised `expression/threw` and pulsed `Failure`. That is precisely
     * the state the Failure Contract says must never fire: "an unset input is not a failure,
     * and a `Failure` port that fires on those trains authors to ignore it." The old `0` seed
     * hid it by making the boot evaluation succeed on a value nobody supplied — the same
     * trade the whole task is about, one level down.
     *
     * A node with no discovered inputs (`2 + 2`) is not gated. It has nothing to wait for.
     */
    anyInputArrived: boolean;
    /**
     * The identifiers the *current* expression actually references.
     *
     * Distinct from `inputNames`, which is `Object.keys(scope)` and therefore also holds
     * ports that exist only because something is wired to them. `2 + 2` with a stray
     * connection on `a` has one registered input and references none, and gating on the
     * registered set made that node abstain forever waiting for a value its expression would
     * not have read. Gate on what the expression asked for.
     */
    referencedPorts: string[];
    /** The full function body, preamble included — not the raw text the author typed. */
    currentExpression: string;
    compiledFunction?: (...args: unknown[]) => unknown;
    inputNames: string[];
    inputValues: unknown[];
    noodlDependencies: NoodlDependencies;
    unsubscribe: (() => void) | null;
    /**
     * Why the last compile failed, captured where it happens.
     *
     * `_compileFunction` swallowed the syntax error and returned `undefined`, so by the time
     * anything noticed, the only message left was the wrapper's — see `_calculateExpression`.
     */
    compileError?: string;
    /** Message for the `Error` output; see NDA-004 §2. */
    lastError?: string;
    /** The last failure already reported, so a re-evaluation does not repeat it. */
    lastReportedError?: string;
    /**
     * One token per `Run` pulse waiting on the coalescing guard — ERG-001 §4.
     *
     * ⚠️ Created lazily in `_scheduleEvaluateExpression`, not in `initialize`.
     */
    pendingRunOutcomes?: OutcomeToken[];
  };
  /** Mutable here: `registerInputIfNeeded` seeds a value before the port exists. */
  _inputValues: Record<string, unknown>;
  _scheduleEvaluateExpression(token?: OutcomeToken): void;
  /** Schedule an evaluation nobody explicitly asked for. See `anyInputArrived`. */
  _scheduleAutomaticEvaluation(): void;
  /** Record a value arrival and re-run if this input is ticked. */
  _onInputValueArrived(name: string, value: unknown): void;
  _calculateExpression(tokens?: OutcomeToken[]): unknown;
  _compileFunction(): (...args: unknown[]) => unknown | undefined;
  _reportFailure(code: string, message: string, detail?: unknown, tokens?: OutcomeToken[]): void;
}

const ExpressionNode: NodeDefinitionOptions = {
  name: 'Expression',
  docs: 'https://docs.noodl.net/nodes/math/expression',
  usePortAsLabel: 'expression',
  category: 'CustomCode',
  color: 'javascript',
  nodeDoubleClickAction: {
    focusPort: 'Expression'
  },
  /**
   * LGC-001 §1 — Expression is the cheapest correct answer to `price * quantity`,
   * so it is the node the arithmetic vocabulary is meant to land on first. It
   * leads the triad because `nodelibraryexport.ts` lists it first in the Logic
   * category, not because of anything here; see `logic-search-tags.ts`.
   */
  searchTags: ['javascript', ...ARITHMETIC_SEARCH_TAGS],
  initialize: function (this: ExpressionNodeInstance) {
    const internal = this._internal;

    internal.scope = {};
    internal.hasScheduledEvaluation = false;

    internal.code = undefined;
    // NDA-017 §2 constraint 4: `null`, not `0`. This value is not private — `connectInput`
    // pushes the `result` getter's answer downstream the moment a wire is made, so whatever
    // starts here is what a consumer reads from a node that has never run. It used to be a
    // confident `0`.
    internal.cachedValue = null;
    internal.hasEvaluated = false;
    internal.anyInputArrived = false;
    internal.referencedPorts = [];
    internal.currentExpression = '';
    internal.compiledFunction = undefined;
    internal.inputNames = [];
    internal.inputValues = [];

    // New: Expression evaluator integration
    internal.noodlDependencies = { variables: [], objects: [], arrays: [] };
    internal.unsubscribe = null;
  },
  methods: {
    // Own cleanup first, then chain — the order every sibling that overrides this uses
    // (see `componentinstance.ts`). This used not to chain at all, so a deleted Expression
    // node never cleared its model listeners, never set `_deleted`, and never unsubscribed
    // its port-level expression subscriptions (PLAT-003 NOTES §25.3 item 3).
    _onNodeDeleted: function (this: ExpressionNodeInstance) {
      // Clean up reactive subscriptions to prevent memory leaks
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }

      Node.prototype._onNodeDeleted.call(this);
    },
    registerInputIfNeeded: function (this: ExpressionNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      // NDA-017 §2. `undefined`, not `0`. The seed was the first of the four routes §0 found
      // to a plausible-looking answer from a node that has nothing to answer with: an
      // `a + b` whose producers have not landed evaluated `0 + 0` and published a `0` that no
      // downstream branch can tell from a legitimate one. `undefined` makes the same
      // evaluation produce `NaN` — still not an answer, but a visibly absent one rather than
      // a plausible one, which is the whole of NDA-004's class-B distinction.
      this._internal.scope[name] = undefined;
      this._inputValues[name] = undefined;

      this.registerInput(name, {
        set: function (this: ExpressionNodeInstance, value: unknown) {
          this._onInputValueArrived(name, value);
        }
      });
      this.registerRunOnValueChangeInput(name);
    },
    _onInputValueArrived: function (this: ExpressionNodeInstance, name: string, value: unknown) {
      this._internal.scope[name] = value;
      this._internal.anyInputArrived = true;
      // NDA-017 §2. This used to read `if (!this.isInputConnected('run'))`, so wiring `Run`
      // made every value port on the node passive without saying so anywhere. Now the only
      // thing that makes a port passive is the author unticking it, and `Run` is additive.
      if (this.shouldRunOnValueChange(name)) this._scheduleEvaluateExpression();
    },
    _scheduleAutomaticEvaluation: function (this: ExpressionNodeInstance) {
      const internal = this._internal;
      if (internal.referencedPorts.length > 0 && !internal.anyInputArrived) return;
      this._scheduleEvaluateExpression();
    },
    _scheduleEvaluateExpression: function (this: ExpressionNodeInstance, token?: OutcomeToken) {
      const internal = this._internal;
      if (token) {
        if (!internal.pendingRunOutcomes) internal.pendingRunOutcomes = [];
        internal.pendingRunOutcomes.push(token);
      }
      // The coalescing constraint (NDA-017 §2 constraint 3) is this flag, and it predates the
      // task: three ticked inputs moving in one frame all land here, the first arms the
      // callback and the other two find it armed. Which is why the checkbox has to gate the
      // *call* to this method and must never be allowed to shortcut into a direct evaluation.
      if (internal.hasScheduledEvaluation === false) {
        internal.hasScheduledEvaluation = true;
        this.flagDirty();
        this.scheduleAfterInputsHaveUpdated(function (this: ExpressionNodeInstance) {
          const lastValue = internal.cachedValue;
          const hadEvaluated = internal.hasEvaluated;
          // Drained before the evaluation, so a `Run` arriving during it owns its own batch.
          const tokens = internal.pendingRunOutcomes || [];
          internal.pendingRunOutcomes = undefined;
          internal.cachedValue = this._calculateExpression(tokens);
          internal.hasEvaluated = true;
          // `!hadEvaluated` is load-bearing: the very first evaluation moves the outputs off
          // `null` even when it happens to land on the same value the getters were reporting,
          // and without it a first result that is itself null or 0 would never be flagged.
          if (!hadEvaluated || lastValue !== internal.cachedValue) {
            this.flagOutputDirty('result');
            this.flagOutputDirty('isTrue');
            this.flagOutputDirty('isFalse');
          }
          if (internal.cachedValue) this.sendSignalOnOutput('isTrueEv');
          else this.sendSignalOnOutput('isFalseEv');
          internal.hasScheduledEvaluation = false;

          // ⚠️ Read off the tokens themselves rather than off any flag `_calculateExpression`
          // left behind: a token that has already been settled as `failure` records that on
          // itself, so this cannot report an outcome the failing branch has already reported.
          // An outcome inferred from state a branch had already changed is the defect the JSON
          // parser's runaway-buffer branch introduced, and this is the shape that cannot have it.
          reportOutcomes(
            this,
            tokens.filter((t) => t.reported === undefined),
            'done'
          );
        });
      }
    },
    /**
     * Report a failure once — NDA-004 §2.
     *
     * Deduplicated by message, and the dedupe is cleared by the next evaluation that works, so
     * a persistent problem reports once and a transient one reports once. Without that, a node
     * whose expression is broken re-reports on every input change, which for a reactive node is
     * every frame something upstream moves: the channel would drown in one author's typo.
     *
     * ⚠️ **The reason `Failure` was safe on this node has been withdrawn — NDA-017 §2.** This
     * comment used to say that `registerInputIfNeeded` seeds every discovered input to `0`
     * rather than `undefined`, so there was no window in which the ports existed but held
     * nothing, so "the values have not arrived yet" was not a state the node passed through.
     * That was true and it is now deliberately false: the seed is `undefined`, precisely so a
     * node with nothing to answer with stops answering `0`. Both readings were correct about
     * their own question — the `0` that made `Failure` safe is the same `0` that made a stale
     * evaluation indistinguishable from a real one.
     *
     * `Failure` stays safe anyway, but for a different and narrower reason: this method is
     * only reached from `_calculateExpression`, which fires it for a *compile* failure or a
     * *thrown* expression. Neither is an unarrived-input state. An expression evaluated over
     * `undefined` inputs produces `NaN` and reports nothing, which is the Empty-Value
     * Contract's abstain, not a failure.
     */
    _reportFailure: function (
      this: ExpressionNodeInstance,
      code: string,
      message: string,
      detail?: unknown,
      tokens?: OutcomeToken[]
    ) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      const isRepeat = internal.lastReportedError === message;
      if (!isRepeat) {
        internal.lastReportedError = message;
        this.raiseRuntimeError(code, message, detail);
      }

      // ⚠️ ERG-001 §4. The tokens settle **outside** the dedup. The dedup is about the
      // *announcement* — a wired input produces a run per keystroke and most intermediate
      // values are broken — while Rule 1 is about the invocation: a second `Run` over the same
      // broken expression still owes its own `Failure` and `Completed`. `raise: false` because
      // the reason is already on the channel from the raise above, or deliberately suppressed
      // as a repeat.
      //
      // `failure` is one port doing two jobs on this node, so it is not pulsed twice: where
      // there are tokens `reportOutcome` owns the pulse, where there are none the value-driven
      // announcement stands.
      if (tokens && tokens.length > 0) {
        reportOutcomes(this, tokens, 'failure', { code, message, detail, raise: false });
      } else if (!isRepeat) {
        this.sendSignalOnOutput('failure');
      }
    },
    _calculateExpression: function (this: ExpressionNodeInstance, tokens?: OutcomeToken[]) {
      const internal = this._internal;

      if (!internal.compiledFunction) {
        internal.compiledFunction = this._compileFunction();
      }

      /**
       * A malformed expression, reported as itself.
       *
       * `_compileFunction` logged the syntax error to the console and returned `undefined`,
       * and this method then called `.apply` on it. The resulting `TypeError` landed in the
       * catch below, so the one diagnosis that ever reached anywhere said *"Cannot read
       * properties of undefined"* — the wrapper's failure, not the author's. The syntax error
       * itself only existed in `evalCompileWarnings`, which is `sendWarning` and therefore
       * editor-only: deployed, a broken expression evaluated to `0` in total silence, and `0`
       * is a value the `Is True`/`Is False` outputs branch on quite happily.
       */
      if (!internal.compiledFunction) {
        this._reportFailure(
          'expression/compile-failed',
          'The expression could not be compiled: ' + (internal.compileError || 'syntax error'),
          { expression: this.model && this.model.parameters ? this.model.parameters.expression : undefined },
          tokens
        );
        return 0;
      }

      for (let i = 0; i < internal.inputNames.length; ++i) {
        const inputValue = internal.scope[internal.inputNames[i]];
        internal.inputValues[i] = inputValue;
      }

      // Get proper Noodl API and append as last parameter for backward compatibility
      const JavascriptNodeParser = require('../../javascriptnodeparser');
      const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context && this.context.modelScope);
      const argsWithNoodl = internal.inputValues.concat([noodlAPI]);

      try {
        const value = internal.compiledFunction.apply(null, argsWithNoodl);
        // An evaluation that worked re-arms the report, so a problem that comes back is heard
        // again rather than being suppressed for the life of the session.
        internal.lastReportedError = undefined;
        internal.lastError = undefined;
        return value;
      } catch (e) {
        // Was `console.error` and nothing else. The `0` returned below is unchanged — altering
        // the value would move behaviour in existing projects, which is not this contract's
        // business — but it is no longer indistinguishable from an expression that genuinely
        // evaluated to zero.
        this._reportFailure('expression/threw', 'The expression threw: ' + e.message, { message: e.message }, tokens);
      }
      return 0;
    },
    _compileFunction: function (this: ExpressionNodeInstance) {
      const expression = this._internal.currentExpression;
      const args = Object.keys(this._internal.scope);

      // Add 'Noodl' as last parameter for backward compatibility
      args.push('Noodl');

      const key = expression + args.join(' ');

      if (compiledFunctionsCache.hasOwnProperty(key) === false) {
        args.push(expression);

        try {
          compiledFunctionsCache[key] = construct(Function, args);
          this._internal.compileError = undefined;
        } catch (e) {
          // Kept rather than reported here: this runs inside `_calculateExpression`, which owns
          // the reporting so that one broken expression produces one event rather than two.
          this._internal.compileError = e.message;
        }
      }
      return compiledFunctionsCache[key];
    }
  },
  getInspectInfo(this: ExpressionNodeInstance): InspectInfo {
    // Wrapped: bare numbers/booleans render as nothing in the inspector (DEBT-006).
    return [{ type: 'value', value: this._internal.cachedValue }];
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
      description: 'JavaScript expression whose value becomes Result; every identifier in it becomes an input port',
      set: function (this: ExpressionNodeInstance, value: string) {
        const internal = this._internal;
        internal.currentExpression = functionPreamble + 'return (' + value + ');';
        internal.compiledFunction = undefined;

        const newInputs = parsePorts(value);
        internal.referencedPorts = newInputs;

        const inputsToAdd: string[] = difference(newInputs, internal.inputNames);
        const inputsToRemove: string[] = difference(internal.inputNames, newInputs);

        const self = this;
        inputsToRemove.forEach(function (name) {
          self.deregisterInput(name);
          self.deregisterRunOnValueChangeInput(name);
          delete internal.scope[name];
        });

        inputsToAdd.forEach(function (name) {
          if (self.hasInput(name)) {
            return;
          }

          self.registerInput(name, {
            set: function (this: ExpressionNodeInstance, value: unknown) {
              this._onInputValueArrived(name, value);
            }
          });
          self.registerRunOnValueChangeInput(name);

          // See `registerInputIfNeeded` for why this is `undefined` and no longer `0`.
          internal.scope[name] = undefined;
          self._inputValues[name] = undefined;
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
              // A Noodl global moving is a value arrival like any other; it just has no port
              // to hang a checkbox on, so it is treated as always-ticked. Routed through the
              // gate for the same reason the load path is: an expression reading both a
              // global and a port must not evaluate over a port that has never delivered.
              self._scheduleAutomaticEvaluation();
            },
            self.context && self.context.modelScope
          );
        }

        internal.inputNames = Object.keys(internal.scope);
        // ⚠️ NDA-017 §2 — **the one place the old guard survives, deliberately.**
        //
        // Every *value* setter on this node is now governed by its own checkbox, so wiring
        // `Run` no longer changes what any of them do. This is not a value setter: it is the
        // port carrying the node's own definition, and it runs at load on every Expression in
        // the project.
        //
        // Making it unconditional would be the literal reading of "Run is purely additive",
        // and on Expression it would be harmless — the node is pure. The identical line in
        // the Function node is not: a Function with `Run` wired to a button and a script that
        // POSTs would fire that POST once, at load, in every project that already exists. The
        // class has to hold one rule, so the rule is that the *command* semantics of a
        // control signal still govern the definition port — "when I change the code, don't
        // run it; I'll say when" — while the value ports are governed by the checkboxes.
        //
        // Surfaced in the handover rather than buried here, because it is the one place the
        // build does not do what the decision says word for word.
        //
        // `_scheduleAutomaticEvaluation` rather than the scheduler directly: see
        // `anyInputArrived` for the NDA-004 regression that distinction exists to prevent.
        if (!this.isInputConnected('run')) this._scheduleAutomaticEvaluation();
      }
    },
    run: {
      group: 'Actions',
      displayName: 'Run',
      type: 'signal',
      // NDA-017 §2. The old sentence — "connecting this stops it evaluating whenever an input
      // changes" — described the trap accurately and was the only place it was written down.
      // It is no longer true: `Run` adds a trigger and takes nothing away.
      description:
        'Evaluates the expression now. This is additional to the inputs that re-run it; untick an input under Run On Value Change to stop that one triggering a run',
      valueChangedToTrue: function (this: ExpressionNodeInstance) {
        // ERG-001 §4. Only the port mints; every value setter and the `expression` setter reach
        // the same scheduler and report nothing.
        this._scheduleEvaluateExpression(this.beginOutcome());
      }
    }
  },
  outputs: {
    /**
     * ## NDA-017 §2 constraint 4 — the three ports below abstain until there is an answer
     *
     * These getters are not only read by the inspector. `connectInput` pushes a source's
     * current output down a wire the moment it is made, so whatever they return before the
     * node has evaluated is what a consumer receives from a node that has never run. §0
     * measured that: a downstream Recorder held a confident `0` from an Expression with `Run`
     * wired, no pulse ever sent, and `signalsFor` empty for the whole of boot.
     *
     * `Is False` was the worst of the three, because `!undefined` is `true`: an Expression
     * that had never evaluated asserted *"my result is falsy"* to every branch downstream,
     * which is a claim and not an absence. All three now answer `null` until
     * `hasEvaluated` — the Empty-Value Contract's abstain, for ports whose empty state is
     * genuinely "no answer yet" rather than a representable zero.
     */
    result: {
      group: 'Result',
      type: '*',
      displayName: 'Result',
      description: 'What the expression evaluated to; null until it has been evaluated at least once',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.hasEvaluated) {
          return null;
        }

        return this._internal.cachedValue;
      }
    },
    isTrue: {
      group: 'Result',
      type: 'boolean',
      displayName: 'Is True',
      description: 'Whether Result is truthy; null until the expression has been evaluated at least once',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.hasEvaluated) {
          return null;
        }

        return !!this._internal.cachedValue;
      }
    },
    isFalse: {
      group: 'Result',
      type: 'boolean',
      displayName: 'Is False',
      description: 'Whether Result is falsy; null until the expression has been evaluated at least once',
      getter: function (this: ExpressionNodeInstance) {
        if (!this._internal.hasEvaluated) {
          return null;
        }

        return !this._internal.cachedValue;
      }
    },
    isTrueEv: {
      group: 'Events',
      type: 'signal',
      displayName: 'On True',
      description: 'Fires after an evaluation whose Result is truthy'
    },
    isFalseEv: {
      group: 'Events',
      type: 'signal',
      displayName: 'On False',
      description: 'Fires after an evaluation whose Result is falsy'
    },
    /**
     * NDA-004 §2. Both failure modes this node has — a malformed expression and one that throws
     * while evaluating — used to return `0` and say nothing outside the editor.
     *
     * `0` is the specific reason this needed a port rather than a log line: it is not an obviously
     * broken value, it is a plausible one. `Is False` fires, `Is True` does not, and every
     * downstream branch takes the path it would have taken for a legitimate zero.
     */
    failure: {
      group: 'Events',
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the expression could not be compiled, or threw while being evaluated'
    },
    /**
     * ERG-001 §4 — `Done` is **added**, and neither `On True` nor `On False` became it.
     *
     * Both fire from the `expression` setter at load and from every ticked value input, which
     * are paths no author invoked. No `Unchanged`: an evaluation always evaluates.
     */
    ...outcomeOutputs({ done: 'Fires once a Run you triggered has evaluated the expression, after On True or On False' }),
    error: {
      group: 'Error',
      type: 'string',
      displayName: 'Error',
      description: 'The compile or evaluation error, in JavaScript\'s own words',
      getter: function (this: ExpressionNodeInstance) {
        return this._internal.lastError;
      }
    },
    // New typed outputs for better downstream compatibility
    asString: {
      group: 'Typed Results',
      type: 'string',
      displayName: 'As String',
      description: 'Result rendered as text, and blank when it is null or undefined',
      getter: function (this: ExpressionNodeInstance) {
        const val = this._internal.cachedValue;
        return val !== undefined && val !== null ? String(val) : '';
      }
    },
    asNumber: {
      group: 'Typed Results',
      type: 'number',
      displayName: 'As Number',
      description: 'Result read as a number, falling back to 0 when it is not one',
      getter: function (this: ExpressionNodeInstance) {
        const val = this._internal.cachedValue;
        return typeof val === 'number' ? val : Number(val) || 0;
      }
    },
    asBoolean: {
      group: 'Typed Results',
      type: 'boolean',
      displayName: 'As Boolean',
      description: 'Whether Result is truthy, for wiring straight to a boolean input',
      getter: function (this: ExpressionNodeInstance) {
        return !!this._internal.cachedValue;
      }
    }
  }
};

const functionPreamble = [
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
function construct(constructor: FunctionConstructor, args: string[]) {
  function F(this: unknown) {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new (F as unknown as { new (): (...args: unknown[]) => unknown })();
}

const compiledFunctionsCache: Record<string, (...args: unknown[]) => unknown> = {};

const portsToIgnore = [
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

/**
 * The whole `runtime-discovered` port mechanism for this node: every identifier in the
 * expression that is not a known built-in becomes an input port.
 *
 * It is a text scan, not a parse, so it is deliberately conservative in one direction only
 * — string literals are stripped first so their contents cannot mint ports, and a dotted
 * path contributes just its root. An identifier inside a comment still would.
 */
function parsePorts(expression: string): string[] {
  const ports: string[] = [];

  function addPort(name: string) {
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
  const identifiers = expression.matchAll(/[a-zA-Z\_\$][a-zA-Z0-9\.\_\$]*/g);
  for (const _id of identifiers) {
    let name = _id[0];
    if (name.indexOf('.') !== -1) {
      name = name.split('.')[0]; // Take first symbol on "." sequence
    }

    addPort(name);
  }

  return ports;
}

function updatePorts(nodeId: string, expression: string, editorConnection: EditorConnectionLike) {
  const portNames = parsePorts(expression);

  const ports = portNames.map(function (name) {
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

  // NDA-017 §2. The runtime mints the matching checkbox in `registerInputIfNeeded`; this is
  // the editor's half, without which the affordance the whole decision is about would exist
  // only as a port nobody can see.
  editorConnection.sendDynamicPorts(nodeId, ports.concat(runOnChangeDynamicPorts(portNames) as never[]));
}

function evalCompileWarnings(editorConnection: EditorConnectionLike, node: GraphNodeModel) {
  const expression = node.parameters.expression as string;
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
    const deps: NoodlDependencies = ExpressionEvaluator.detectDependencies(expression);
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

const ExpressionNodeModule: NodeModule = {
  node: ExpressionNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Expression', function (node: GraphNodeModel) {
      if (node.parameters.expression) {
        updatePorts(node.id, node.parameters.expression as string, context.editorConnection);
        evalCompileWarnings(context.editorConnection, node);
      }
      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'expression') {
          updatePorts(node.id, node.parameters.expression as string, context.editorConnection);
          evalCompileWarnings(context.editorConnection, node);
        }
      });
    });
  }
};

export = ExpressionNodeModule;
