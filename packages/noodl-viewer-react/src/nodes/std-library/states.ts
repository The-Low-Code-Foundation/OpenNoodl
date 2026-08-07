import BezierEasing from 'bezier-easing';
import { EdgeTriggeredInput } from '@noodl/runtime';
import { nearestName } from '@noodl/runtime/src/diagnostics';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type {
  EditorConnectionLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken,
  StateTransition,
  Timer
} from '@noodl/types';

import EaseCurves from '../../easecurves';

/** `[r, g, b, a]`, each 0–255. */
type RGBA = [number, number, number, number];

/** The value types a state parameter can carry, as chosen by the `type-<value>` port. */
type StateValueType = 'number' | 'string' | 'boolean' | 'color' | 'textStyle';

/**
 * The extra state this node hangs off its transition timer. `TimerOptions` copies unknown
 * keys onto the timer, and the callbacks run as methods on it, so `onStart`/`onRunning`
 * reach these through `this`.
 */
interface StatesTimer extends Timer {
  transitionCurves: Record<string, StateTransition>;
  startValues: Record<string, number | RGBA>;
  targetValues: Record<string, number | RGBA>;
  valueTypes: Record<string, 'number' | 'color'>;
}

interface StatesInstance extends NodeInstance {
  _internal: {
    useTransitions: boolean;
    currentValues: Record<string, unknown>;
    /** Every `value-<state>-<name>`, `transition-…` and `duration-…` port value, by port name. */
    stateParameters: Record<string, any>;
    /** Every `type-<name>` port value, by port name. */
    stateParameterTypes: Record<string, StateValueType>;
    startValues: Record<string, unknown>;
    bezierEaseCurves: Record<string, unknown>;
    transitionFuncs: Record<string, { get(t: number): number }>;
    valuesAreInitialised: boolean;
    animation: StatesTimer;
    states?: string[];
    values?: string[];
    state?: string;
    startState?: string;
    goToState?: string;
    /**
     * Every state requested during the current update pass, in the order they were asked
     * for. NDA-002 §4: the node used to keep only the last one, so A → B → A inside one pass
     * cancelled itself out and nothing fired at all.
     */
    /**
     * ⚠️ ERG-001 §4 made each entry carry its own token rather than adding a parallel array: a
     * `To A` and a `To B` queued in the same frame are two invocations and each is owed its own
     * outcome, which is the shape `statesnapshotnode.ts` established. The token is absent on the
     * setter-driven routes (`currentState`, `startState`, the `states` list arriving), because
     * nobody invoked those.
     */
    goToStateQueue?: Array<{ state: string; token?: OutcomeToken }>;
    /** Latest failure message, for the `Error` output (NDA-004 §2). */
    error?: string;
  };
  /**
   * Set directly on the instance rather than in `_internal` — the original does this and
   * it is load-bearing, so it is declared rather than moved.
   */
  hasScheduledGoToState?: boolean;
  scheduleGoToState(state: string, token?: OutcomeToken): void;
  _failNoStates(token: OutcomeToken): void;
  /** `settleImmediately` skips the animation, so a state passed *through* still reports. */
  goToState(state?: string, settleImmediately?: boolean, token?: OutcomeToken): void;
  jumpToState(state?: string): void;
  updateAtStatePorts(): void;
  _failUnknownState(state: string, token?: OutcomeToken): void;
}

const defaultDuration = 300;
const previousStates: Record<string, string[] | undefined> = {},
  previousValues: Record<string, string[] | undefined> = {};

function setRGBA(result: RGBA, hex: string) {
  if (hex === 'transparent' || !hex) {
    result[3] = 0;
    return;
  }

  const numComponents = (hex.length - 1) / 2;

  for (let i = 0; i < numComponents; ++i) {
    const index = 1 + i * 2;
    result[i] = parseInt(hex.substring(index, index + 2), 16);
  }
}

function componentToHex(c: number) {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function rgbaToHex(rgba: RGBA) {
  return '#' + componentToHex(rgba[0]) + componentToHex(rgba[1]) + componentToHex(rgba[2]) + componentToHex(rgba[3]);
}

/**
 * Output names this node owns, which a *value* name therefore cannot take.
 *
 * `failure` and `stateChanged` are the node's own; the outcome contract's three are reserved
 * ahead of ERG-001 §4 adopting them here, so that a project written between now and then cannot
 * quietly create the collision. See `registerOutputIfNeeded`.
 */
const RESERVED_OUTPUTS = ['failure', 'stateChanged', 'done', 'unchanged', 'completed'];

/** Raised on the error bus and cleared as a diagnostic. One name, so the two cannot drift. */
const UNKNOWN_STATE_CODE = 'states/unknown-state';

const StatesNode: NodeDefinitionOptions = {
  name: 'States',
  docs: 'https://docs.noodl.net/nodes/utilities/logic/states',
  category: 'Animation',
  ssr: {
    compat: 'partial',
    note: 'The scheduler clock is frozen during server render; state transitions do not animate or complete there.'
  },
  initialize: function (this: StatesInstance) {
    const _this = this,
      _internal = this._internal;

    _internal.useTransitions = true;
    _internal.currentValues = {};
    _internal.stateParameters = {};
    _internal.stateParameterTypes = {};
    _internal.startValues = {};
    _internal.bezierEaseCurves = {};
    _internal.transitionFuncs = {};

    _internal.valuesAreInitialised = false;
    _internal.animation = this.context.timerScheduler.createTimer({
      duration: defaultDuration,
      ease: EaseCurves.easeOut,
      onStart: function (this: StatesTimer) {
        const startValues = _internal.startValues;
        const stateValues = _internal.stateParameters;
        const valueTypes = _internal.stateParameterTypes;
        const prefix = 'value-' + _internal.state + '-';

        this.targetValues = {};
        this.startValues = {};
        this.valueTypes = {};

        for (const v in this.transitionCurves) {
          // var v = values[i];

          if (valueTypes['type-' + v] === 'number' || valueTypes['type-' + v] === undefined) {
            this.valueTypes[v] = 'number';
            this.startValues[v] = startValues[v] as number;
            this.targetValues[v] = stateValues[prefix + v] || 0;
          } else if (valueTypes['type-' + v] === 'color') {
            this.valueTypes[v] = 'color';

            this.startValues[v] = [0, 0, 0, 255];
            setRGBA(
              this.startValues[v] as RGBA,
              _this.context.styles.resolveColor((startValues[v] as string) || '#000000')
            );

            this.targetValues[v] = [0, 0, 0, 255];
            setRGBA(
              this.targetValues[v] as RGBA,
              _this.context.styles.resolveColor(stateValues[prefix + v] || '#000000')
            );
          }
        }
      },
      onRunning: function (this: StatesTimer, t: number) {
        const ms = t * this.duration;
        const currentValues = _internal.currentValues;

        const rgba2: RGBA = [0, 0, 0, 255];
        for (const v in this.transitionCurves) {
          const c = this.transitionCurves[v];
          //  var v = values[i];

          if (ms < c.delay) currentValues[v] = this.startValues[v];
          else if (ms >= c.delay + c.dur)
            currentValues[v] =
              this.valueTypes[v] === 'color' ? rgbaToHex(this.targetValues[v] as RGBA) : this.targetValues[v];
          else {
            const _t = _internal.transitionFuncs[v].get((ms - c.delay) / c.dur);
            if (this.valueTypes[v] === 'number') {
              //convert values to Numers, since they might be strings, which can cause NaN
              currentValues[v] = EaseCurves.linear(Number(this.startValues[v]), Number(this.targetValues[v]), _t);
            } else if (this.valueTypes[v] === 'color') {
              const rgba0 = this.startValues[v] as RGBA;
              const rgba1 = this.targetValues[v] as RGBA;
              rgba2[0] = Math.floor(EaseCurves.linear(rgba0[0], rgba1[0], _t));
              rgba2[1] = Math.floor(EaseCurves.linear(rgba0[1], rgba1[1], _t));
              rgba2[2] = Math.floor(EaseCurves.linear(rgba0[2], rgba1[2], _t));
              rgba2[3] = Math.floor(EaseCurves.linear(rgba0[3], rgba1[3], _t));

              currentValues[v] = rgbaToHex(rgba2);
            }
          }
          _this.flagOutputDirty(v);
        }
      },
      onFinish: function () {
        const port = 'reached-' + _internal.state;
        if (_this.hasOutput(port)) _this.sendSignalOnOutput(port);
      }
    }) as StatesTimer;

    // NDA-012 (Animation), check H1. See `animate-to-value.ts` — a transition in flight when
    // the node is deleted kept ticking, and `onRunning` flags an output dirty per value per
    // frame, so this was the noisiest of the four sites.
    this.addDeleteListener(() => {
      _internal.animation.stop();
    });
  },
  getInspectInfo(this: StatesInstance) {
    return `Current state: ${this._internal.state}`;
  },
  inputs: {
    states: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'States',
      group: 'States',
      description: 'Names of the states this node can be in; the node starts in the first',
      set: function (this: StatesInstance, value: string) {
        this._internal.states = value ? value.split(',') : [];

        // Set the state to first value if no state change is scheduled during
        // input updates
        if (this._internal.states.length > 0) {
          const _this = this;
          if (!_this._internal.state) this.scheduleGoToState(_this._internal.startState || _this._internal.states[0]);
          /*  this.scheduleAfterInputsHaveUpdated(function () {
                        if (!_this._internal.state) _this.goToState(_this._internal.startState ||_this._internal.states[0]);
                    });*/
        }
      }
    },
    values: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Values',
      group: 'Values',
      description: 'Names of the values that differ between states, each becoming an output',
      set: function (this: StatesInstance, value: string) {
        const internal = this._internal;
        // NDA-012 (Animation). `value.split` unguarded, where the `states` setter directly
        // above has always had `value ? … : []`. The stringlist editor hands back `undefined`
        // when the author deletes the last entry, so emptying Values threw a `TypeError` out
        // of an input setter — which `nodecontext.ts` catches and `console.error`s, abandoning
        // the rest of this node's update pass. Same guard as its sibling, for the same reason.
        internal.values = value ? value.split(',') : [];

        // Register output values at this point
        for (const i in internal.values) {
          const name = internal.values[i];

          /**
           * ERG-001 §0.2 — the one unguarded verbatim-name surface in the library, guarded on the
           * path that owns it. Value names become output ports **as written**, and the
           * `hasOutput` skip in `registerOutputIfNeeded` is a silent one: a value called `done`
           * would resolve to the outcome contract's signal and the author's value output would
           * simply not exist, with nothing anywhere saying why. That is FINDINGS **SR-ix**.
           */
          if (RESERVED_OUTPUTS.indexOf(name) !== -1) {
            this.raiseRuntimeError(
              'states/reserved-port-name',
              `"${name}" is one of the node's own output ports and cannot also be a value — rename the value`,
              { name }
            );
            continue;
          }

          this.registerOutputIfNeeded(name);
        }
      }
    },
    toggle: {
      group: 'Go to state',
      displayName: 'Toggle',
      description: 'Moves to the next state in the list, wrapping round after the last',
      valueChangedToTrue: function (this: StatesInstance) {
        const internal = this._internal;
        // ERG-001 §4. `Toggle` and every `To <state>` are this node's action ports; the
        // `currentState`/`startState` setters and the `states` list arriving are not.
        const token = this.beginOutcome();

        if (!internal.states || internal.states.length === 0) {
          // Was a bare `return`. A Toggle on a node with no States list is a configuration
          // mistake an author can only find by staring at the panel, and the graph behind it
          // stopped dead with no diagnosis anywhere.
          this._failNoStates(token);
          return;
        }

        // Figure out which state to toggle to
        const idx = internal.states.indexOf(internal.state);
        const nextIdx = (idx + 1) % internal.states.length;

        // Go to state when all updates have updated
        //this._internal.scheduledToGoToState = internal.states[nextIdx];
        this.scheduleGoToState(internal.states[nextIdx], token);
        /*  this.scheduleAfterInputsHaveUpdated(function () {
                    _this.goToState(internal.states[nextIdx]);
                });*/
      }
    },
    useTransitions: {
      type: 'boolean',
      displayName: 'Use Transitions',
      group: 'General',
      description: 'Whether a state change animates its values or jumps straight to them',
      default: true,
      set: function (this: StatesInstance, value: boolean) {
        const internal = this._internal;
        internal.useTransitions = value;
      }
    }
  },
  outputs: {
    currentState: {
      type: 'string',
      displayName: 'State',
      group: 'Current State',
      description: 'Which state the node is in now',
      getter: function (this: StatesInstance) {
        return this._internal.state;
      }
    },
    stateChanged: {
      type: 'signal',
      displayName: 'State Changed',
      group: 'Current State',
      description: 'Fires on every state change except entering the first, which is where the node starts'
    },
    /**
     * NDA-004 §2. `goToState` never checked that the state it was handed was one of the node's
     * own, and the consequences were the Expression node's all over again: a name that is not in
     * the list has no `value-<state>-<name>` parameters, so `onStart` fell through to
     * `stateValues[prefix + v] || 0` and animated **every value to 0** — black for colours, zero
     * for numbers. The node then set `State` to the bogus name and fired `stateChanged`, so
     * everything downstream was told a transition had succeeded. No `reached-<state>` port exists
     * for a state that does not exist, so the one signal that would have looked wrong never fired.
     *
     * A plausible result, arrived at by a broken route — the class the contract calls strictly
     * worse than an obviously broken one.
     *
     * The port is safe on the happy path for the reason `Expression`'s is: the guard fires only
     * for a **truthy** state that is not in the list. A falsy request is resolved to the first
     * state a line above (that is the boot path, and `states`'s own setter uses it), and the
     * `currentState` port's default is `startState || states[0]`, so a node nobody has wired
     * never reaches this branch.
     */
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Which state was asked for and which ones this node actually has',
      getter: function (this: StatesInstance) {
        return this._internal.error;
      }
    },
    /**
     * ERG-001 §4. `State Changed` is **not** this invocation's outcome and could not be made
     * into one: it fires from the `currentState` and `startState` setters and from the `states`
     * list arriving, none of which anybody invoked, and it deliberately does not fire when the
     * node enters its very first state. `Done` goes beside it.
     *
     * `Unchanged` is earned twice over — asking for the state the node is already in, and asking
     * again for the state this pass is already heading to. Both are a graph working exactly as
     * written, so neither raises. The three names were already reserved against verbatim value
     * names by the OBS-003 pass; see `RESERVED_OUTPUTS` above.
     */
    ...outcomeOutputs({
      done: 'Fires once a Toggle or To <state> you triggered has moved the node, after State Changed',
      unchanged: 'Fires when the node is already in the state you asked for, or already heading there in this pass',
      failure: 'Fires when a state was asked for that this node does not have, leaving it where it was'
    })
  },
  prototypeExtensions: {
    registerOutputIfNeeded: function (this: StatesInstance, name: string) {
      const internal = this._internal;

      /**
       * ⚠️ The reserved check is **not** here, and that is deliberate — ERG-001 live QA,
       * 2026-08-02. This method has two callers and only one of them carries a name an author
       * chose: the `values` setter below passes what was typed, while `nodescope.ts:121` passes
       * the source port of every connection, which is how a runtime-discovered output is brought
       * into being. Judging the name here cannot tell those apart, so wiring the node's own
       * `State Changed` — or any of the four ports §4 added — raised the collision against a
       * graph with nothing wrong with it. The check now sits on the `values` path, which is the
       * only one with a name to judge.
       */
      if (this.hasOutput(name)) return;

      this.registerOutput(name, {
        getter: function () {
          return internal.currentValues[name];
        }
      });
    },
    // The `runtime-discovered` mechanism, and the widest use of it in the library: the port
    // name itself encodes what the port is. Every branch below is a different naming scheme,
    // and `updatePorts` at the bottom of this file is what tells the editor they exist.
    registerInputIfNeeded: function (this: StatesInstance, name: string) {
      const _this = this;
      const internal = this._internal;

      if (this.hasInput(name)) return;

      if (name.indexOf('to-') === 0) {
        // This is a go to state signal input
        const toState = name.substring(3);
        this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: function (this: StatesInstance) {
              //this._internal.scheduledToGoToState = state;
              this.scheduleGoToState(toState, this.beginOutcome());
              //this.scheduleAfterInputsHaveUpdated(function () { _this.goToState(state) });
            }
          })
        });
      } else if (name === 'startState') {
        // Note: this is kept for backwards compatability, but this port is no longer part of the dynamic ports def
        // Other state parameters are stored
        this.registerInput(name, {
          set: function (this: StatesInstance, value: string) {
            //this._internal.scheduledToGoToState = value;
            this._internal.startState = value;
            this.scheduleGoToState(value);
            //   this.scheduleAfterInputsHaveUpdated(function () { _this.goToState(value); });
          }
        });
      } else if (name === 'currentState') {
        this.registerInput(name, {
          set: this.scheduleGoToState.bind(this)
        });
      } else if (name.indexOf('type-') === 0) {
        this.registerInput(name, {
          set: function (value: StateValueType) {
            internal.stateParameterTypes[name] = value;
          }
        });
      } else if (name.indexOf('value-') === 0) {
        // Other state parameters are stored
        const parts = name.split('-');
        const valueState = parts[1];
        const valueName = parts[2];

        this.registerInput(name, {
          set: function (value: unknown) {
            internal.stateParameters[name] = value;
            if (internal.state === valueState) {
              // If we are at the state, update the current value immediately
              internal.currentValues[valueName] = value;
              _this.flagOutputDirty(valueName);
            }
          }
        });
      } else if (name.search(/duration-/g) === 0) {
        this.registerInput(name, {
          set: function (value: unknown) {
            internal.stateParameters[name] = value;
          }
        });
      } else if (name.search(/transition/g) === 0) {
        this.registerInput(name, {
          set: function (value: unknown) {
            internal.stateParameters[name] = value;
            /*   if (value === 'cubicBezier') {
                            this.updateCubicBezierFunction(state); //create a default bezier easing curve
                        }*/
          }
        });
      }
      /*   else if (name.search(/cubicBezierP[1-2][X-Y]-/g) === 0) {
                var state = name.substring(15);
                this.registerInput(name, {
                    set: function (value) {
                        internal.stateParameters[name] = value;
                        this.updateCubicBezierFunction(state); //update easing curve
                    }

                });
            }*/
    },
    /*   updateCubicBezierFunction: function (state) {
            var points = [];
            var internal = this._internal;
            ['1X', '1Y', '2X', '2Y'].forEach(function (p, i) {
                var value = internal.stateParameters['cubicBezierP' + p + '-' + state] || 0;
                if (i % 2 === 0) {
                    //X values must equal [0,1]
                    value = Math.min(1, Math.max(0, value));
                }
                points.push(value);
            });
            var cubicBezierEase = BezierEasing(points);
            internal.bezierEaseCurves[state] = function (start, end, t) {
                return EaseCurves.linear(start, end, cubicBezierEase.get(t));
            };
        },*/
    setCurrentState: function (this: StatesInstance, value: string) {
      this.scheduleGoToState(value);
    },
    jumpToState: function (this: StatesInstance, state?: string) {
      const internal = this._internal;
      if (!internal.states) return;
      if (!state) state = internal.states[0];
      if (internal.state === state) return;

      internal.animation.stop();

      const prefix = 'value-' + state + '-';
      for (const i in internal.values) {
        const v = internal.values[i];

        internal.currentValues[v] = internal.stateParameters[prefix + v] || 0;

        this.flagOutputDirty(v);
      }

      internal.state = state;
      //console.log('currentState dirty:' + state);
      this.flagOutputDirty('currentState');

      if (internal.valuesAreInitialised) {
        // Do not send state changed on first initial state set.
        //
        // Deliberate, and left alone by NDA-002 §4 — but worth naming, because it is the
        // *other* reason this node looks like it fires at random. Entering the very first
        // state is the node arriving at where it starts, not a transition an author asked
        // for, so nothing downstream is told. An author who wires `stateChanged` and then
        // wonders why the initial state produced nothing is seeing this, not the coalescing
        // defect above.
        //console.log('stateChanged signal', state);
        this.sendSignalOnOutput('stateChanged');
      }
      internal.valuesAreInitialised = true;

      this.updateAtStatePorts();
    },
    /**
     * NDA-002 §4 (corpus R8/R9).
     *
     * This used to keep only the *last* state requested during a pass: a second call
     * overwrote `_internal.goToState` and returned, and if it had overwritten back to the
     * state the node was already in, `goToState`'s equality guard then returned too. Driving
     * A → B → A inside one update pass produced no `stateChanged`, no `reached-A`, no
     * `reached-B` and no port updates — an author who requested two transitions observed
     * none, which is precisely the "your change was silently discarded" class the reactivity
     * contract exists to eliminate.
     *
     * The requests are queued instead, and the queue is run. Coalescing the *animation* is
     * still right — a state machine should not start two transitions in a frame — so every
     * state the pass passes *through* is settled immediately, reporting `stateChanged` and
     * its `reached-<state>`, and only the state the pass ends in animates.
     */
    /** Report a request made against a node with no States list at all — ERG-001 §4. */
    _failNoStates: function (this: StatesInstance, token: OutcomeToken) {
      const message = 'This States node has no states defined, so there is nowhere to go';
      this._internal.error = message;
      this.flagOutputDirty('error');
      this.reportOutcome(token, 'failure', { code: 'states/no-states', message });
    },
    scheduleGoToState: function (this: StatesInstance, state: string, token?: OutcomeToken) {
      const _this = this;
      const internal = this._internal;

      // OBS-003 — withdraw the standing accusation, and do it *here*.
      //
      // ⚠️ **A failure raised on the error bus has no path back to the editor.**
      // `createEditorWarningSubscriber` only ever calls `sendWarning`, so the danger ring and the
      // Problems entry raised by `_failUnknownState` outlived the fix: an author who corrected the
      // state name watched the node stay red for the rest of the session. That is the "panel
      // becomes noise and gets ignored" failure `DIAGNOSTICS-CONTRACT.md` exists to prevent,
      // arriving through the one channel that contract does not own.
      //
      // ⚠️ **The first attempt put this in `goToState`, after the unknown-state guard, and a live
      // run caught it doing nothing in the commonest case.** The likeliest correction of
      // `"Clicked"` is `"clicked"` — the state the node is *already in*, because that is what the
      // author meant all along — and both the `pendingTarget === state` return below and
      // `goToState`'s `internal.state === state` return skip it. The predicate is about the name
      // on the input, not about whether a transition results, so it is evaluated where every
      // request arrives.
      //
      // Only the editor's standing claim is withdrawn. The failure *event* is untouched: it
      // happened, it reached `On App Error` and a deployed console when it happened, and nothing
      // rewrites that. The `states` guard is the same one `_failUnknownState` needs — this runs
      // before `states` has necessarily been set.
      if (state && internal.states && internal.states.indexOf(state) !== -1) {
        this.setDiagnostic(UNKNOWN_STATE_CODE, null);
      }

      if (!internal.goToStateQueue) internal.goToStateQueue = [];
      const queue = internal.goToStateQueue;

      // Asking again for where the pass is already heading is not a transition. A falsy
      // state is left to `goToState`, which resolves it to the first state.
      const pendingTarget = queue.length > 0 ? queue[queue.length - 1].state : internal.state;
      if (state && pendingTarget === state) {
        // ERG-001 §4: the author asked for something already happening, which is a no-op and
        // not a failure. Reported rather than dropped — the bare `return` was the dead chain.
        if (token) this.reportOutcome(token, 'unchanged');
        return;
      }

      queue.push({ state, token });
      this._internal.goToState = state;

      //console.log('set go to state: ' + state)
      if (this.hasScheduledGoToState) return;
      this.hasScheduledGoToState = true;
      this.scheduleAfterInputsHaveUpdated(function () {
        //console.log('changing state: ' + _this._internal.goToState)
        _this.hasScheduledGoToState = false;

        // Drained before the loop, so a state change requested *by* one of these signals
        // starts a fresh queue and a fresh pass rather than extending this one.
        const requested = queue.splice(0, queue.length);
        for (let i = 0; i < requested.length; i++) {
          _this.goToState(requested[i].state, i < requested.length - 1, requested[i].token);
        }
      });
    },
    /**
     * NDA-004 §2 — the one place a requested state is checked against the list.
     *
     * `goToState` is the single entry point: `jumpToState` is only ever reached from the branch
     * below, and `scheduleGoToState` cannot do the check itself because it runs before `states`
     * has necessarily been set. Guarding here also means the queue is unaffected — a rejected
     * state leaves `internal.state` alone, so a later request for a real state still works.
     */
    _failUnknownState: function (this: StatesInstance, state: string, token?: OutcomeToken) {
      const states = this._internal.states || [];
      // Name the alternatives. "Unknown state" is not actionable; "you have A, B, C" is, and a
      // wired `State` input misspelt or left behind by a rename is the common cause.
      //
      // OBS-003. The near-match is the phase-36 worked example: a States node receives
      // `"Clicked"` and the state is named `"clicked"`. Listing the real states already made
      // that solvable, but only by an author who read the list carefully and spotted one
      // capital letter — which is precisely the reading nobody does at the end of an afternoon.
      // Naming the candidate turns it into one glance.
      const suggestion = nearestName(state, states);
      const message =
        'Cannot go to state "' +
        state +
        '" — this node has no such state. Its states are: ' +
        (states.length > 0 ? states.join(', ') : '(none defined)') +
        '.' +
        (suggestion ? ' Did you mean "' + suggestion + '"?' : '');

      this._internal.error = message;
      this.flagOutputDirty('error');
      this.raiseRuntimeError(UNKNOWN_STATE_CODE, message, { requested: state, states: states.slice() });

      // ⚠️ ERG-001 §4. `failure` is one port doing two jobs on this node — the invocation's
      // outcome, and the announcement this method has always made from setter-driven routes
      // that nobody invoked. So it is not pulsed twice: where there is a token `reportOutcome`
      // owns the pulse, with `raise: false` because the reason is already on the channel from
      // the line above.
      if (token) {
        this.reportOutcome(token, 'failure', { code: UNKNOWN_STATE_CODE, message, raise: false });
      } else {
        this.sendSignalOnOutput('failure');
      }
    },
    goToState: function (this: StatesInstance, state?: string, settleImmediately?: boolean, token?: OutcomeToken) {
      const internal = this._internal;
      if (!internal.states) {
        if (token) this._failNoStates(token);
        return;
      }
      if (!state) state = internal.states[0];
      if (internal.state === state) {
        // Already where it was asked to go. `Unchanged`, and it does not raise: a `Failure`
        // firing on a graph working exactly as written is how authors learn to ignore the port.
        if (token) this.reportOutcome(token, 'unchanged');
        return;
      }

      if (internal.states.indexOf(state) === -1) {
        // Refusing to move is the point, not just the report. Transitioning to a state whose
        // values do not exist is what produced the animate-everything-to-zero behaviour; staying
        // put leaves the node in a state it actually has.
        this._failUnknownState(state, token);
        return;
      }

      //this._internal.scheduledToGoToState = undefined;
      if (!internal.valuesAreInitialised) {
        // First time go to state is called, jump to the state
        this.jumpToState(state);
        if (token) this.reportOutcome(token, 'done');
      } else {
        // Copy current values as start values
        let delay = 0;
        let dur = 0;
        const transitionCurves: Record<string, StateTransition> = {};
        for (const i in internal.values) {
          const v = internal.values[i];

          internal.startValues[v] = internal.currentValues[v];

          const parameterType = internal.stateParameterTypes['type-' + v];
          if (parameterType === 'boolean') {
            // These types don't transition, just set them
            const _b = internal.stateParameters['value-' + state + '-' + v];
            internal.currentValues[v] = _b === undefined ? false : !!_b;
            this.flagOutputDirty(v);
          } else if (parameterType === 'string' || parameterType === 'textStyle') {
            // These types don't transition, just set them
            internal.currentValues[v] = internal.stateParameters['value-' + state + '-' + v];
            this.flagOutputDirty(v);
          } else {
            // Figure out transition curve
            let transitionCurve: StateTransition = internal.stateParameters['transition-' + state + '-' + v];
            if (!transitionCurve)
              transitionCurve = internal.stateParameters['transitiondef-' + state] || {
                curve: [0.0, 0.0, 0.58, 1.0],
                dur: 300,
                delay: 0
              };

            if (
              (transitionCurve.dur === 0 && transitionCurve.delay === 0) ||
              !internal.useTransitions ||
              // A state the pass only passed through: settle it so it is observable, rather
              // than starting an animation the next queued state would cancel a line later.
              settleImmediately
            ) {
              // Simply set the target value
              internal.currentValues[v] = internal.stateParameters['value-' + state + '-' + v];
              this.flagOutputDirty(v);
            } else {
              // Calculate total duration and delay
              internal.transitionFuncs[v] = BezierEasing(transitionCurve.curve);
              transitionCurves[v] = transitionCurve;
              delay = Math.min(delay, transitionCurve.delay);
              dur = Math.max(dur, transitionCurve.dur + transitionCurve.delay);
            }
          }
        }

        // Setup and start animation
        //var easeCurveName = internal.stateParameters['transition-' + state] || 'easeOut';
        //internal.animation.ease = easeCurveName === 'cubicBezier' ? internal.bezierEaseCurves[state] : EaseCurves[easeCurveName];
        //var durationKey = 'duration-' + state;
        //internal.animation.duration = internal.stateParameters.hasOwnProperty(durationKey) ? internal.stateParameters[durationKey] : defaultDuration;
        if (dur > 0 || delay > 0) {
          internal.animation.transitionCurves = transitionCurves;
          internal.animation.duration = dur;
          internal.animation.delay = delay;
          internal.animation.start();
        }

        internal.state = state;
        //console.log('currentState dirty:' + state);
        this.flagOutputDirty('currentState');

        //console.log('stateChanged signal', state);
        this.sendSignalOnOutput('stateChanged');
        this.updateAtStatePorts();

        if (dur == 0 && delay == 0) {
          // Send reached signal if no transition
          const port = 'reached-' + internal.state;
          if (this.hasOutput(port)) this.sendSignalOnOutput(port);
        }

        // Last, after `State Changed`, the At-state ports and any `Has Reached`. A transition
        // that is still animating has already *moved* the node — `State` reads the new name and
        // `stateChanged` has fired — so `Done` is honest here rather than at `onFinish`, which
        // is what `Has Reached <state>` exists to say.
        if (token) this.reportOutcome(token, 'done');
      }
    },
    updateAtStatePorts: function (this: StatesInstance) {
      const internal = this._internal;
      const states = internal.states;
      for (const i in states) {
        const s = states[i];
        const port = 'at-' + s;

        internal.currentValues[port] = internal.state === s;
        if (this.hasOutput(port)) this.flagOutputDirty(port);
      }
    }
  }
};

/** The one name that moved between two same-length lists, if exactly one did. */
interface RenameResult {
  before?: string;
  after?: string;
}

function detectRename(before: string[] | undefined, after: string[] | undefined): RenameResult | undefined {
  if (!before || !after) return;

  if (before.length !== after.length) return; // Must be of same length

  const res: RenameResult = {};
  for (let i = 0; i < before.length; i++) {
    if (after.indexOf(before[i]) === -1) {
      if (res.before) return; // Can only be one from before that is missing
      res.before = before[i];
    }

    if (before.indexOf(after[i]) === -1) {
      if (res.after) return; // Only one can be missing,otherwise we cannot match
      res.after = after[i];
    }
  }

  return res.before && res.after ? res : undefined;
}

/** A rename hint the editor uses to carry connections across a port rename. */
interface RenamePattern {
  plug: 'input' | 'output';
  before: string;
  after: string;
  patterns: string[] | undefined;
}

function updatePorts(nodeId: string, parameters: Record<string, any>, editorConnection: EditorConnectionLike) {
  let states: string[] | undefined = parameters.states;
  let values: string[] | undefined = parameters.values;

  const ports = [];

  // Add value outputs
  values = values ? (values as unknown as string).split(',') : undefined;
  for (const i in values) {
    const p = values[i];

    ports.push({
      type: {
        name: parameters['type-' + p] || 'number',
        allowConnectionsOnly: true
      },
      plug: 'output',
      group: 'Values',
      name: p
    });

    // Type selector
    ports.push({
      type: {
        name: 'enum',
        enums: [
          { label: 'Number', value: 'number' },
          { label: 'String', value: 'string' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'Color', value: 'color' },
          { label: 'Text Style', value: 'textStyle' }
        ],
        allowEditOnly: true
      },
      default: 'number',
      plug: 'input',
      group: 'Types',
      displayName: p,
      name: 'type-' + p
    });
  }

  // Add state value inputs
  states = states ? (states as unknown as string).split(',') : undefined;
  states &&
    states.forEach(function (state) {
      values &&
        values.forEach(function (value) {
          ports.push({
            plug: 'input',
            type: parameters['type-' + value] || 'number',
            group: state + ' Values',
            name: 'value-' + state + '-' + value,
            displayName: value,
            editorName: state + '|' + value
          });
        });

      // State transition
      if (values && parameters['useTransitions'] !== false) {
        ports.push({
          plug: 'input',
          type: 'curve',
          displayName: 'Default',
          default: { curve: [0.0, 0.0, 0.58, 1.0], dur: 300, delay: 0 },
          group: state + ' Transitions',
          name: 'transitiondef-' + state
        });

        values.forEach(function (value) {
          if (
            parameters['type-' + value] === undefined ||
            parameters['type-' + value] === 'number' ||
            parameters['type-' + value] === 'color'
          ) {
            ports.push({
              plug: 'input',
              type: { name: 'curve' },
              default: parameters['transitiondef-' + state] || {
                curve: [0.0, 0.0, 0.58, 1.0],
                dur: 300,
                delay: 0
              },
              group: state + ' Transitions',
              name: 'transition-' + state + '-' + value,
              displayName: value,
              editorName: 'Transition ' + state + '|' + value
            });
          }
        });
      }

      /*  ports.push({
            plug: 'input',
            type: {
                name: 'enum',
                enums: [
                    { value: 'easeOut', label: "Ease Out" },
                    { value: 'easeIn', label: "Ease In" },
                    { value: 'linear', label: "Linear" },
                    { value: 'easeInOut', label: "Ease In Out" },
                    { value: 'cubicBezier', label: 'Cubic Bezier' }
                ]
            },
            default: 'easeOut',
            displayName: "Easing Curve",
            group: state + ' Transition',
            name: 'transition-' + state,
        });

        //add cubic bezier inputs if transition is set to cubic
        if (parameters['transition-' + state] === 'cubicBezier') {
            ports = ports.concat([
                {
                    name: 'cubicBezierP1X-' + state,
                    editorName: state + '|' + 'P1 X',
                    displayName: 'P1 X',
                    group: state + ' Transition',
                    plug: 'input',
                    type: 'number',
                    default: 0
                },
                {
                    name: 'cubicBezierP1Y-' + state,
                    editorName: state + '|' + 'P1 Y',
                    displayName: 'P1 Y',
                    group: state + ' Transition',
                    plug: 'input',
                    type: 'number',
                    default: 0
                },
                {
                    name: 'cubicBezierP2X-' + state,
                    editorName: state + '|' + 'P2 X',
                    displayName: 'P2 X',
                    group: state + ' Transition',
                    plug: 'input',
                    type: 'number',
                    default: 0
                },
                {
                    name: 'cubicBezierP2Y-' + state,
                    editorName: state + '|' + 'P2 Y',
                    displayName: 'P2 Y',
                    group: state + ' Transition',
                    plug: 'input',
                    type: 'number',
                    default: 0
                }
            ]);
        }

        ports.push({
            plug: 'input',
            type: 'number',
            default: defaultDuration,
            displayName: "Duration",
            group: state + ' Transition',
            name: 'duration-' + state,
        });*/

      // Go to state port
      ports.push({
        plug: 'input',
        type: { name: 'signal', allowConnectionsOnly: true },
        displayName: 'To ' + state,
        name: 'to-' + state,
        group: 'Go to state'
      });

      // At state output
      ports.push({
        plug: 'output',
        type: 'boolean',
        displayName: 'At ' + state,
        name: 'at-' + state,
        group: 'Current state'
      });

      // Has reached state output
      ports.push({
        plug: 'output',
        type: 'signal',
        displayName: 'Has Reached ' + state,
        name: 'reached-' + state,
        group: 'Current state'
      });
    });

  // Add current state port
  if (states) {
    ports.push({
      plug: 'input',
      type: { name: 'enum', enums: states },
      group: 'States',
      displayName: 'State',
      name: 'currentState',
      default: parameters['startState'] || states[0] // This is kept for backwards compatability, the startState port does no longer exist
    });
  }

  // Detect state and value rename
  const stateRenamed = detectRename(previousStates[nodeId], states);
  previousStates[nodeId] = states;

  const valueRenamed = detectRename(previousValues[nodeId], values);
  previousValues[nodeId] = values;

  let renamed: RenamePattern | RenamePattern[];
  if (stateRenamed) {
    const stateRename: RenamePattern = {
      plug: 'input',
      before: stateRenamed.before,
      after: stateRenamed.after,
      patterns: [
        'transition-{{*}}',
        /*       'duration-{{*}}',
                'cubicBezierP1X-{{*}}',
                'cubicBezierP2X-{{*}}',
                'cubicBezierP1Y-{{*}}',
                'cubicBezierP2Y-{{*}}',*/
        'to-{{*}}',
        'at-{{*}}',
        'reached-{{*}}'
      ]
    };
    renamed = stateRename;

    // A state has been renamed
    values &&
      values.forEach(function (value) {
        stateRename.patterns.push('value-{{*}}-' + value);
      });
  } else if (valueRenamed) {
    renamed = [
      {
        plug: 'output',
        before: valueRenamed.before,
        after: valueRenamed.after,
        patterns: ['{{*}}']
      },
      {
        plug: 'input',
        before: valueRenamed.before,
        after: valueRenamed.after,
        patterns: ['type-{{*}}']
      },
      {
        plug: 'input',
        before: valueRenamed.before,
        after: valueRenamed.after,
        patterns: states
          ? states.map(function (s) {
              return 'value-' + s + '-' + '{{*}}';
            })
          : undefined
      }
    ];
  }

  editorConnection.sendDynamicPorts(nodeId, ports, { renamed: renamed });
}

const StatesModule: NodeModule = {
  node: StatesNode,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.States', function (node: GraphNodeModel) {
      if (node.parameters.states) {
        updatePorts(node.id, node.parameters, editorConnection);
      }
      node.on('parameterUpdated', function (event: { name: string }) {
        if (
          event.name === 'useTransitions' ||
          event.name === 'states' ||
          event.name === 'values' ||
          event.name.startsWith('transition') ||
          event.name.startsWith('type-')
        ) {
          updatePorts(node.id, node.parameters, editorConnection);
        }
      });
    });
  }
};

export default StatesModule;
