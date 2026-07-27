'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule, Timer } from '@noodl/types';

import EaseCurves, { type EaseCurve } from '../../easecurves';

const defaultDuration = 300;

/**
 * The timer this node drives, with the three extras it hangs off it — the
 * documented way to give a timer per-use state, read back through `this` inside
 * `onRunning`.
 */
interface TransitionTimer extends Timer {
  startValue: number;
  endValue: number;
  ease: EaseCurve;
}

/** `this` inside the Transition node. */
interface TransitionNodeInstance extends NodeInstance {
  _internal: {
    currentNumber: number;
    /** False until the first `targetValue` arrives, which is adopted rather than animated to. */
    numberInitialized: boolean;
    animationStarted: boolean;
    setCurrentNumberEnabled: boolean;
    overrideValue: number;
    _animation: TransitionTimer;
  };
}

const TransitionNode: NodeDefinitionOptions = {
  name: 'Transition',
  docs: 'https://docs.noodl.net/nodes/animation/transition',
  shortDesc: 'This node can interpolate smooothely for the current value to a target value.',
  category: 'Animation',
  deprecated: true,
  ssr: {
    compat: 'partial',
    note: 'The scheduler clock is frozen during server render; the transition does not animate or complete there.'
  },
  initialize: function (this: TransitionNodeInstance) {
    const self = this,
      _internal = this._internal;

    _internal.currentNumber = 0;
    _internal.numberInitialized = false;
    _internal.animationStarted = false;
    _internal.setCurrentNumberEnabled = false;
    _internal.overrideValue = 0;

    // `createTimer` returns a plain `Timer`; the three extras below are copied onto
    // it verbatim by the constructor, which is what makes it a `TransitionTimer`.
    _internal._animation = this.context.timerScheduler.createTimer({
      duration: defaultDuration,
      startValue: 0,
      endValue: 0,
      ease: EaseCurves.easeOut,
      onStart: function () {
        _internal.animationStarted = true;
      },
      onRunning: function (this: TransitionTimer, t: number) {
        _internal.currentNumber = this.ease(this.startValue, this.endValue, t);
        self.flagOutputDirty('currentValue');
      },
      onFinish: function () {
        self.sendSignalOnOutput('atTargetValue');
      }
    }) as TransitionTimer;
  },
  inputs: {
    targetValue: {
      type: {
        name: 'number'
      },
      displayName: 'Target Value',
      group: 'Target Value',
      default: undefined, //default is undefined so transition initializes to the first input value
      set: function (this: TransitionNodeInstance, input: number | boolean) {
        let value: number;
        if (input === true) {
          value = 1;
        } else if (input === false) {
          value = 0;
        } else {
          value = Number(input);
        }

        if (isNaN(value)) {
          //bail out on NaN values
          return;
        }

        const internal = this._internal;

        if (internal.numberInitialized === false) {
          internal.currentNumber = value;
          internal.numberInitialized = true;
          internal._animation.endValue = value;
          this.flagOutputDirty('currentValue');
          return;
        } else if (value === internal._animation.endValue) {
          //same as previous value
          return;
        }

        internal._animation.startValue = internal.currentNumber;
        internal._animation.endValue = value;
        internal._animation.start();
      }
    },
    'overrideCurrentValue.value': {
      type: {
        name: 'number'
      },
      group: 'Override Value',
      displayName: 'Override Value',
      editorName: 'Value|Override Value',
      set: function (this: TransitionNodeInstance, value: number) {
        this._internal.overrideValue = value;
      }
    },
    'overrideCurrentValue.do': {
      group: 'Override Value',
      displayName: 'Do',
      editorName: 'Do|Override Value',
      valueChangedToTrue: function (this: TransitionNodeInstance) {
        setCurrentNumber.call(this, this._internal.overrideValue);
      }
    },
    duration: {
      type: 'number',
      group: 'Parameters',
      displayName: 'Duration',
      default: defaultDuration,
      set: function (this: TransitionNodeInstance, value: number) {
        this._internal._animation.duration = value;
      }
    },
    delay: {
      type: 'number',
      group: 'Parameters',
      displayName: 'Delay',
      default: 0,
      set: function (this: TransitionNodeInstance, value: number) {
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
      set: function (this: TransitionNodeInstance, value: string) {
        this._internal._animation.ease = EaseCurves[value];
      }
    }
  },
  outputs: {
    currentValue: {
      type: 'number',
      displayName: 'Current Value',
      group: 'Current State',
      getter: function (this: TransitionNodeInstance) {
        return this._internal.currentNumber;
      }
    },
    atTargetValue: {
      type: 'signal',
      displayName: 'At Target Value',
      group: 'Signals'
    }
  }
};

function setCurrentNumber(this: TransitionNodeInstance, value: number) {
  /* jshint validthis:true */
  const animation = this._internal._animation;

  animation.stop();
  animation.startValue = value;

  //wait until all values are set until checking if animation needs to be started
  this.scheduleAfterInputsHaveUpdated(function () {
    if (animation.endValue !== value) {
      animation.start();
    }
  });
  this._internal.currentNumber = value;
  this.flagOutputDirty('currentValue');
}

const TransitionNodeModule: NodeModule = {
  node: TransitionNode
};

export default TransitionNodeModule;
