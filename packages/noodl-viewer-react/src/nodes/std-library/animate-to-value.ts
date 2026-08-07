import type { InspectInfo, NodeDefinitionOptions, NodeInstance, Timer } from '@noodl/types';

import EaseCurves from '../../easecurves';

type EaseFn = (start: number, end: number, t: number) => number;

/**
 * The extra state this node hangs off its timer. `TimerOptions` copies unknown keys onto
 * the timer verbatim and the callbacks run as methods on it, so `onRunning` reads these
 * back through `this`.
 */
interface AnimationTimer extends Timer {
  startValue: number;
  endValue: number;
  ease: EaseFn;
}

interface AnimateToValueInstance extends NodeInstance {
  _internal: {
    currentNumber: number;
    numberInitialized: boolean;
    animationStarted: boolean;
    setCurrentNumberEnabled: boolean;
    overrideValue: number;
    _animation: AnimationTimer;
  };
}

const defaultDuration = 300;

const AnimateToValue: NodeDefinitionOptions = {
  name: 'net.noodl.animatetovalue',
  docs: 'https://docs.noodl.net/nodes/logic/animate-to-value',
  displayName: 'Animate To Value',
  category: 'Animation',
  ssr: {
    compat: 'partial',
    note: 'The scheduler clock is frozen during server render; the value stays at its start and Finished never fires there.'
  },
  initialize: function (this: AnimateToValueInstance) {
    const self = this,
      _internal = this._internal;

    _internal.currentNumber = 0;
    _internal.numberInitialized = false;
    _internal.animationStarted = false;
    _internal.setCurrentNumberEnabled = false;
    _internal.overrideValue = 0;

    _internal._animation = this.context.timerScheduler.createTimer({
      duration: defaultDuration,
      startValue: 0,
      endValue: 0,
      ease: EaseCurves.easeOut,
      onStart: function () {
        _internal.animationStarted = true;
      },
      onRunning: function (this: AnimationTimer, t: number) {
        _internal.currentNumber = this.ease(this.startValue, this.endValue, t);
        self.flagOutputDirty('currentValue');
      },
      onFinish: function () {
        self.sendSignalOnOutput('atTargetValue');
      }
    }) as AnimationTimer;

    /**
     * NDA-012 (Animation), check H1 — one shape, four sites.
     *
     * `TimerScheduler` holds a running timer in `runningTimers` until something stops it
     * (`timerscheduler.ts:96-112`); deleting a node does not. So a node deleted mid-animation
     * kept being ticked every frame, calling `flagOutputDirty` on a dead node and holding the
     * whole instance reachable through the scheduler. The sibling `Delay` node has had this
     * listener since it was written (`timer.ts:38-40`) — the three animation nodes and
     * `States` simply never got one.
     */
    this.addDeleteListener(() => {
      this._internal._animation.stop();
    });
  },
  getInspectInfo(this: AnimateToValueInstance): InspectInfo {
    // Wrapped as a value entry — a bare number renders as nothing in the
    // editor's inspector popup (DEBT-006, PLAT-003 NOTES §13.3).
    return [{ type: 'value', value: this._internal.currentNumber }];
  },
  inputs: {
    targetValue: {
      type: {
        name: 'number'
      },
      displayName: 'Target Value',
      group: 'Target Value',
      description: 'Value to move towards; the first one to arrive is adopted outright rather than animated to',
      default: undefined, //default is undefined so transition initializes to the first input value
      set: function (this: AnimateToValueInstance, value: unknown) {
        if (value === true) {
          value = 1;
        } else if (value === false) {
          value = 0;
        }

        const numeric = Number(value);

        if (isNaN(numeric)) {
          //bail out on NaN values
          return;
        }

        const internal = this._internal;

        if (internal.numberInitialized === false) {
          internal.currentNumber = numeric;
          internal.numberInitialized = true;
          internal._animation.endValue = numeric;
          this.flagOutputDirty('currentValue');
          return;
        } else if (numeric === internal._animation.endValue) {
          //same as previous value
          return;
        }

        internal._animation.startValue = internal.currentNumber;
        internal._animation.endValue = numeric;
        internal._animation.start();
      }
    },
    duration: {
      type: 'number',
      group: 'Parameters',
      displayName: 'Duration',
      description: 'How long the move takes, in milliseconds',
      default: defaultDuration,
      set: function (this: AnimateToValueInstance, value: number) {
        this._internal._animation.duration = value;
      }
    },
    delay: {
      type: 'number',
      group: 'Parameters',
      displayName: 'Delay',
      description: 'How long to wait before the move begins, in milliseconds',
      default: 0,
      set: function (this: AnimateToValueInstance, value: number) {
        this._internal._animation.delay = value;
      }
    },
    easingCurve: {
      type: {
        name: 'enum',
        enums: [
          { value: 'easeOut', label: 'Ease Out' },
          { value: 'easeIn', label: 'Ease In' },
          { value: 'linear', label: 'Linear' },
          { value: 'easeInOut', label: 'Ease In Out' }
        ]
      },
      default: 'easeOut',
      displayName: 'Easing Curve',
      group: 'Parameters',
      description: 'Shape of the movement between where the value is and Target Value',
      set: function (this: AnimateToValueInstance, value: string) {
        this._internal._animation.ease = EaseCurves[value];
      }
    }
  },
  outputs: {
    currentValue: {
      type: 'number',
      displayName: 'Current Value',
      group: 'Current State',
      description: 'Where the move has got to, updated every frame while it runs',
      getter: function (this: AnimateToValueInstance) {
        return this._internal.currentNumber;
      }
    },
    atTargetValue: {
      type: 'signal',
      displayName: 'At Target Value',
      group: 'Signals',
      description: 'Fires when the value settles on Target Value, and not at all if a new target interrupted it'
    }
  }
};

export default {
  node: AnimateToValue
};
