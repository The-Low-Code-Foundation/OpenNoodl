import BezierEasing from 'bezier-easing';
import { EdgeTriggeredInput } from '@noodl/runtime';
import type {
  EditorConnectionLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
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
  };
  /**
   * Set directly on the instance rather than in `_internal` — the original does this and
   * it is load-bearing, so it is declared rather than moved.
   */
  hasScheduledGoToState?: boolean;
  scheduleGoToState(state: string): void;
  goToState(state: string): void;
  jumpToState(state?: string): void;
  updateAtStatePorts(): void;
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

const StatesNode: NodeDefinitionOptions = {
  name: 'States',
  docs: 'https://docs.noodl.net/nodes/utilities/logic/states',
  shortDesc: 'Define states with values and this node can interpolate between these values when the state is changed.',
  category: 'Animation',
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
  },
  getInspectInfo(this: StatesInstance) {
    return `Current state: ${this._internal.state}`;
  },
  inputs: {
    states: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'States',
      group: 'States',
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
      set: function (this: StatesInstance, value: string) {
        const internal = this._internal;
        internal.values = value.split(',');

        // Register output values at this point
        for (const i in internal.values) {
          this.registerOutputIfNeeded(internal.values[i]);
        }
      }
    },
    toggle: {
      group: 'Go to state',
      displayName: 'Toggle',
      valueChangedToTrue: function (this: StatesInstance) {
        const internal = this._internal;

        if (!internal.states) return;

        // Figure out which state to toggle to
        const idx = internal.states.indexOf(internal.state);
        const nextIdx = (idx + 1) % internal.states.length;

        // Go to state when all updates have updated
        //this._internal.scheduledToGoToState = internal.states[nextIdx];
        this.scheduleGoToState(internal.states[nextIdx]);
        /*  this.scheduleAfterInputsHaveUpdated(function () {
                    _this.goToState(internal.states[nextIdx]);
                });*/
      }
    },
    useTransitions: {
      type: 'boolean',
      displayName: 'Use Transitions',
      group: 'General',
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
      getter: function (this: StatesInstance) {
        return this._internal.state;
      }
    },
    stateChanged: {
      type: 'signal',
      displayName: 'State Changed',
      group: 'Current State'
    }
  },
  prototypeExtensions: {
    registerOutputIfNeeded: function (this: StatesInstance, name: string) {
      const internal = this._internal;

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
              this.scheduleGoToState(toState);
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
        // Do not send state changed on first initial state set
        //console.log('stateChanged signal', state);
        this.sendSignalOnOutput('stateChanged');
      }
      internal.valuesAreInitialised = true;

      this.updateAtStatePorts();
    },
    scheduleGoToState: function (this: StatesInstance, state: string) {
      const _this = this;

      this._internal.goToState = state;

      //console.log('set go to state: ' + state)
      if (this.hasScheduledGoToState) return;
      this.hasScheduledGoToState = true;
      this.scheduleAfterInputsHaveUpdated(function () {
        //console.log('changing state: ' + _this._internal.goToState)
        _this.hasScheduledGoToState = false;
        _this.goToState(_this._internal.goToState);
      });
    },
    goToState: function (this: StatesInstance, state?: string) {
      const internal = this._internal;
      if (!internal.states) return;
      if (!state) state = internal.states[0];
      if (internal.state === state) return;

      //this._internal.scheduledToGoToState = undefined;
      if (!internal.valuesAreInitialised) {
        // First time go to state is called, jump to the state
        this.jumpToState(state);
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

            if ((transitionCurve.dur === 0 && transitionCurve.delay === 0) || !internal.useTransitions) {
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
