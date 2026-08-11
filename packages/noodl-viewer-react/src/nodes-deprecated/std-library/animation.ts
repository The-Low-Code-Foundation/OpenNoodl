'use strict';

import BezierEasing from 'bezier-easing';
import type { NodeDefinitionOptions, NodeInstance, NodeModule, Timer } from '@noodl/types';

import EaseCurves, { type EaseCurve } from '../../easecurves';

/** The timer a {@link SubAnimation} drives, with the two extras hung off it. */
interface SubAnimationTimer extends Timer {
  startValue: number;
  endValue: number;
}

interface SubAnimationArgs {
  name: string;
  ease: EaseCurve;
  node: AnimationNodeInstance;
}

/**
 * One animated output of the Animation node.
 *
 * Declared as an interface merged with the constructor function below, rather
 * than rewritten as a class: the prototype is built with
 * `Object.defineProperties`, and this keeps the conversion type-only.
 */
interface SubAnimation {
  name: string;
  startValue: number;
  endValue: number;
  /** `undefined` while stopped, which is what makes the output read as nothing. */
  currentValue: number | undefined;
  /** `'implicit'` samples the connected input's current value as the start. */
  startMode: 'implicit' | 'explicit' | (string & {});
  ease: EaseCurve;
  node: AnimationNodeInstance;
  hasSampledStartValue: boolean;
  animation: SubAnimationTimer;

  setCurrentValue(value: number | undefined): void;
  play(start: number | undefined, end: number | undefined): void;
  playToEnd(): void;
  playToStart(): void;
  replayToEnd(): void;
  replayToStart(): void;
  hasConnections(): boolean;
  getTargetsCurrentValue(): number;
  updateStartValue(): void;
  stop(): void;
  jumpToStart(): void;
  jumpToEnd(): void;
}

/** `this` inside the Animation node. */
interface AnimationNodeInstance extends NodeInstance {
  _internal: {
    duration: number;
    ease: EaseCurve;
    /** Which direction the run in progress is going; read by the timer's `onFinish`. */
    _isPlayingToEnd: boolean;
    /** One entry per animated output port. */
    animations: SubAnimation[];
    cubicBezierPoints: [number, number, number, number];
    cubicBezierFunction: EaseCurve | undefined;
    /** Drives the signal outputs only; each sub-animation runs its own timer. */
    animation: Timer;
  };
  updateCubicBezierFunction(): void;
  _registerAnimationGroup(name: string): void;
}

function SubAnimation(this: SubAnimation, args: SubAnimationArgs) {
  this.name = args.name;
  this.startValue = 0;
  this.endValue = 0;
  this.currentValue = undefined;
  this.startMode = 'implicit';
  this.ease = args.ease;
  this.node = args.node;
  this.hasSampledStartValue = false;

  const self = this;

  this.animation = args.node.context.timerScheduler.createTimer({
    startValue: 0,
    endValue: 0,
    onRunning: function (this: SubAnimationTimer, t: number) {
      const value = self.ease(this.startValue, this.endValue, t);
      self.setCurrentValue(value);
    }
  }) as SubAnimationTimer;
  this.animation.startValue = 0;
  this.animation.endValue = 0;
}

Object.defineProperties(SubAnimation.prototype, {
  setCurrentValue: {
    value: function (this: SubAnimation, value: number | undefined) {
      this.currentValue = value;
      this.node.flagOutputDirty(this.name);
    }
  },
  play: {
    value: function (this: SubAnimation, start: number | undefined, end: number | undefined) {
      if (start === undefined) {
        console.log('Animation warning, start value is undefined');
        start = 0;
      }
      if (end === undefined) {
        console.error('Animation error, start:', start, 'end:', end);
        return;
      }
      const animation = this.animation;
      animation.startValue = start;
      this.setCurrentValue(start);
      animation.endValue = end;
      animation.duration = this.node._internal.duration;
      animation.start();
    }
  },
  playToEnd: {
    value: function (this: SubAnimation) {
      if (this.hasConnections() === false) {
        return;
      }
      this.updateStartValue();
      this.play(this.getTargetsCurrentValue(), this.endValue);
    }
  },
  playToStart: {
    value: function (this: SubAnimation) {
      if (this.hasConnections() === false) {
        return;
      }
      this.updateStartValue();
      this.play(this.getTargetsCurrentValue(), this.startValue);
    }
  },
  replayToEnd: {
    value: function (this: SubAnimation) {
      if (this.hasConnections() === false) {
        return;
      }
      this.updateStartValue(); //in case animation doesn't have an explicit start value set
      this.play(this.startValue, this.endValue);
    }
  },
  replayToStart: {
    value: function (this: SubAnimation) {
      if (this.hasConnections() === false) {
        return;
      }
      this.play(this.endValue, this.startValue);
    }
  },
  hasConnections: {
    value: function (this: SubAnimation) {
      return this.node.getOutput(this.name).hasConnections();
    }
  },
  getTargetsCurrentValue: {
    value: function (this: SubAnimation) {
      const valueConnections = this.node.getOutput(this.name).connections;

      //TODO: this will only work for the first connection
      const value = valueConnections[0].node.getInputValue(valueConnections[0].inputPortName);
      // A unit-carrying input arrives as `{ value, unit }`; the number is what animates.
      return value instanceof Object && value.hasOwnProperty('value')
        ? (value as { value: number }).value
        : (value as number);
    }
  },
  updateStartValue: {
    value: function (this: SubAnimation) {
      if (this.startMode !== 'implicit' || this.hasSampledStartValue) {
        return;
      }

      this.hasSampledStartValue = true;
      this.startValue = this.getTargetsCurrentValue();
    }
  },
  stop: {
    value: function (this: SubAnimation) {
      this.animation.stop();
      this.setCurrentValue(undefined);
    }
  },
  jumpToStart: {
    value: function (this: SubAnimation) {
      this.animation.stop();
      this.setCurrentValue(this.startValue);
    }
  },
  jumpToEnd: {
    value: function (this: SubAnimation) {
      this.animation.stop();
      this.setCurrentValue(this.endValue);
    }
  }
});

const easeEnum = [
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'linear', label: 'Linear' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'cubicBezier', label: 'Cubic Bezier' }
];

const defaultDuration = 300;

const AnimationNode: NodeDefinitionOptions = {
  name: 'Animation',
  docs: 'https://docs.noodl.net/nodes/animation/animation',
  category: 'Animation',
  deprecated: true,
  ssr: {
    compat: 'partial',
    note: 'The scheduler clock is frozen during server render; animations do not run or complete there.'
  },
  initialize: function (this: AnimationNodeInstance) {
    const internal = this._internal;

    internal.duration = defaultDuration;
    internal.ease = EaseCurves.easeOut;
    internal._isPlayingToEnd = false;
    internal.animations = [];
    internal.cubicBezierPoints = [0, 0, 0, 0];
    internal.cubicBezierFunction = undefined;

    const self = this;

    internal.animation = this.context.timerScheduler.createTimer({
      onFinish: function () {
        if (internal._isPlayingToEnd === false) {
          self.sendSignalOnOutput('hasReachedStart');
        } else {
          self.sendSignalOnOutput('hasReachedEnd');
        }
      }
    });

    /**
     * NDA-012 (Animation), check H1. See `animate-to-value.ts`. This node is the worst of
     * the four sites because it owns *n+1* timers — one signalling timer plus one per
     * animated output — and none of them were stopped.
     *
     * The sub-animations are stopped through the scheduler rather than through
     * `SubAnimation.stop()`, which also calls `setCurrentValue(undefined)`: pushing a value
     * out of a node that is being deleted is exactly what this is fixing.
     */
    this.addDeleteListener(() => {
      internal.animation.stop();
      for (const sub of internal.animations) sub.animation.stop();
    });
  },
  inputs: {
    duration: {
      index: 0,
      type: 'number',
      displayName: 'Duration (ms)',
      group: 'Animation Properties',
      description: 'How long a play takes, in milliseconds',
      default: defaultDuration,
      set: function (this: AnimationNodeInstance, value: number) {
        this._internal.duration = value;
      }
    },
    easingCurve: {
      index: 10,
      type: {
        name: 'enum',
        enums: easeEnum
      },
      group: 'Animation Properties',
      displayName: 'Easing Curve',
      description: 'Shape of the movement between each value\'s start and end',
      default: 'easeOut',
      set: function (this: AnimationNodeInstance, value: string) {
        let easeCurve: EaseCurve;
        if (value === 'cubicBezier') {
          this.updateCubicBezierFunction();
          easeCurve = this._internal.cubicBezierFunction;
        } else {
          easeCurve = EaseCurves[value];
        }

        this._internal.ease = easeCurve;
      }
    },
    playToEnd: {
      index: 20,
      group: 'Play',
      displayName: 'To End',
      description: 'Animates every value from where it is now to its end value',
      editorName: 'Play To End',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        this._internal._isPlayingToEnd = true;

        const animation = this._internal.animation,
          animations = this._internal.animations,
          self = this;

        this.scheduleAfterInputsHaveUpdated(function () {
          animation.duration = self._internal.duration;
          animation.start();
          for (let i = 0; i < animations.length; i++) {
            animations[i].ease = self._internal.ease;
            animations[i].playToEnd();
          }
        });
      }
    },
    playToStart: {
      index: 21,
      group: 'Play',
      displayName: 'To Start',
      description: 'Animates every value from where it is now to its start value',
      editorName: 'Play To Start',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        this._internal._isPlayingToEnd = false;
        const animation = this._internal.animation,
          animations = this._internal.animations,
          self = this;

        this.scheduleAfterInputsHaveUpdated(function () {
          animation.duration = self._internal.duration;
          animation.start();
          for (let i = 0; i < animations.length; i++) {
            animations[i].ease = self._internal.ease;
            animations[i].playToStart();
          }
        });
      }
    },
    replayToEnd: {
      index: 22,
      group: 'Play',
      displayName: 'From Start To End',
      description: 'Animates every value from its start value to its end value, wherever it is now',
      editorName: 'Play From Start To End',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        const animation = this._internal.animation,
          animations = this._internal.animations,
          self = this;

        this._internal._isPlayingToEnd = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          animation.duration = self._internal.duration;
          animation.start();
          for (let i = 0; i < animations.length; i++) {
            animations[i].ease = self._internal.ease;
            animations[i].replayToEnd();
          }
        });
      }
    },
    replayToStart: {
      index: 23,
      group: 'Play',
      displayName: 'From End To Start',
      description: 'Animates every value from its end value to its start value, wherever it is now',
      editorName: 'Play From End To Start',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        this._internal._isPlayingToEnd = false;
        const animation = this._internal.animation,
          animations = this._internal.animations,
          self = this;

        this.scheduleAfterInputsHaveUpdated(function () {
          animation.duration = self._internal.duration;
          animation.start();
          for (let i = 0; i < animations.length; i++) {
            animations[i].ease = self._internal.ease;
            animations[i].replayToStart();
          }
        });
      }
    },
    stop: {
      index: 60,
      group: 'Instant Actions',
      displayName: 'Stop',
      description: 'Abandons the play in progress, leaving every animated output unset',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        const animation = this._internal.animation,
          animations = this._internal.animations;

        animation.stop();
        for (let i = 0; i < animations.length; i++) {
          animations[i].stop();
        }
      }
    },
    jumpToStart: {
      index: 61,
      group: 'Instant Actions',
      displayName: 'Jump To Start',
      description: 'Sets every value to its start value with no animation',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        const animations = this._internal.animations;

        for (let i = 0; i < animations.length; i++) {
          animations[i].jumpToStart();
        }

        this.sendSignalOnOutput('hasReachedStart');
      }
    },
    jumpToEnd: {
      index: 62,
      group: 'Instant Actions',
      displayName: 'Jump To End',
      description: 'Sets every value to its end value with no animation',
      valueChangedToTrue: function (this: AnimationNodeInstance) {
        const animations = this._internal.animations;

        for (let i = 0; i < animations.length; i++) {
          animations[i].jumpToEnd();
        }

        this.sendSignalOnOutput('hasReachedEnd');
      }
    },
    cubicBezierP1X: {
      displayName: 'P1 X',
      group: 'Cubic Bezier',
      description: 'First control point along the time axis, clamped between 0 and 1; used only when Easing Curve is Cubic Bezier',
      type: {
        name: 'number'
      },
      index: 11,
      set: function (this: AnimationNodeInstance, value: number) {
        this._internal.cubicBezierPoints[0] = Math.min(1, Math.max(0, value));
        this.updateCubicBezierFunction();
      }
    },
    cubicBezierP1Y: {
      displayName: 'P1 Y',
      group: 'Cubic Bezier',
      description: 'First control point along the value axis, where beyond 0 and 1 overshoots; used only when Easing Curve is Cubic Bezier',
      type: {
        name: 'number'
      },
      index: 12,
      set: function (this: AnimationNodeInstance, value: number) {
        this._internal.cubicBezierPoints[1] = value;
        this.updateCubicBezierFunction();
      }
    },
    cubicBezierP2X: {
      displayName: 'P2 X',
      group: 'Cubic Bezier',
      description: 'Second control point along the time axis, clamped between 0 and 1; used only when Easing Curve is Cubic Bezier',
      type: {
        name: 'number'
      },
      index: 13,
      set: function (this: AnimationNodeInstance, value: number) {
        this._internal.cubicBezierPoints[2] = Math.min(1, Math.max(0, value));
        this.updateCubicBezierFunction();
      }
    },
    cubicBezierP2Y: {
      displayName: 'P2 Y',
      group: 'Cubic Bezier',
      description: 'Second control point along the value axis, where beyond 0 and 1 overshoots; used only when Easing Curve is Cubic Bezier',
      type: {
        name: 'number'
      },
      index: 14,
      set: function (this: AnimationNodeInstance, value: number) {
        this._internal.cubicBezierPoints[3] = value;
        this.updateCubicBezierFunction();
      }
    }
  },
  outputs: {
    hasReachedStart: {
      type: 'signal',
      group: 'Events',
      displayName: 'Has Reached Start',
      description: 'Fires when a play towards the start values has finished'
    },
    hasReachedEnd: {
      type: 'signal',
      group: 'Events',
      displayName: 'Has Reached End',
      description: 'Fires when a play towards the end values has finished'
    }
  },
  dynamicports: [
    {
      condition: 'easingCurve = cubicBezier',
      inputs: ['cubicBezierP1X', 'cubicBezierP1Y', 'cubicBezierP2X', 'cubicBezierP2Y']
    },
    //animation outputs
    {
      name: 'expand/basic',
      indexStep: 100,
      template: [
        {
          name: '{{portname}}.startMode',
          type: {
            name: 'enum',
            enums: [
              {
                value: 'explicit',
                label: 'Explicit'
              },
              {
                value: 'implicit',
                label: 'Implicit'
              }
            ],
            allowEditOnly: true
          },
          plug: 'input',
          group: '{{portname}} Animation',
          displayName: 'Start Mode',
          default: 'implicit',
          index: 1000
        },
        {
          name: '{{portname}}.endValue',
          type: 'number',
          plug: 'input',
          group: '{{portname}} Animation',
          displayName: 'End Value',
          editorName: 'End Value | {{portname}} ',
          default: 0,
          index: 1002
        }
      ]
    },
    {
      name: 'expand/basic',
      condition: "'{{portname}}.startMode' = explicit",
      indexStep: 100,
      template: [
        {
          name: '{{portname}}.startValue',
          plug: 'input',
          type: 'number',
          displayName: 'Start Value',
          editorName: 'Start Value | {{portname}}',
          group: '{{portname}} Animation',
          default: 0,
          index: 1001
        }
      ]
    }
  ],
  panels: [
    {
      name: 'PortEditor',
      title: 'Animations',
      plug: 'output',
      type: { name: 'number' },
      group: 'Animation Values'
    }
  ],
  prototypeExtensions: {
    updateCubicBezierFunction: {
      value: function (this: AnimationNodeInstance) {
        const points = this._internal.cubicBezierPoints;
        const cubicBezierEase = BezierEasing(points);
        this._internal.cubicBezierFunction = function (start: number, end: number, t: number) {
          return EaseCurves.linear(start, end, cubicBezierEase.get(t));
        };
        this._internal.ease = this._internal.cubicBezierFunction;
      }
    },
    _registerAnimationGroup: {
      value: function (this: AnimationNodeInstance, name: string) {
        const subAnimation: SubAnimation = new SubAnimation({
          node: this,
          ease: this._internal.ease,
          name: name
        });

        this._internal.animations.push(subAnimation);

        const inputs: Record<string, { default?: number; set(value: never): void }> = {};

        inputs[name + '.' + 'startMode'] = {
          set: function (value: string) {
            subAnimation.startMode = value;
          }
        };
        inputs[name + '.' + 'startValue'] = {
          default: 0,
          set: function (value: number) {
            subAnimation.startValue = value;
          }
        };
        inputs[name + '.' + 'endValue'] = {
          default: 0,
          set: function (value: number) {
            subAnimation.endValue = value;
          }
        };

        this.registerInputs(inputs);

        this.registerOutput(name, {
          getter: function () {
            return subAnimation.currentValue;
          }
        });
      }
    },
    registerInputIfNeeded: {
      value: function (this: AnimationNodeInstance, name: string) {
        if (this.hasInput(name)) {
          return;
        }

        const dotIndex = name.indexOf('.'),
          animationName = name.substr(0, dotIndex);

        if (this.hasOutput(animationName)) {
          return;
        }

        this._registerAnimationGroup(animationName);
      }
    },
    registerOutputIfNeeded: {
      value: function (this: AnimationNodeInstance, name: string) {
        if (this.hasOutput(name)) {
          return;
        }

        this._registerAnimationGroup(name);
      }
    }
  }
};

const AnimationNodeModule: NodeModule = {
  node: AnimationNode
};

export default AnimationNodeModule;
