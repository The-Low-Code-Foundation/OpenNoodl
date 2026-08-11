import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { NodeDefinitionOptions, NodeInstance, Timer as SchedulerTimer } from '@noodl/types';

interface TimerInstance extends NodeInstance {
  _internal: {
    /**
     * `_isRunning` is the scheduler's own private flag, read directly by the `start`
     * input below. It is not on the published `Timer` interface — `isRunning()` is —
     * so it is declared here rather than widening the shared type.
     */
    _animation: SchedulerTimer & { _isRunning: boolean };
  };
}

const Timer: NodeDefinitionOptions = {
  name: 'Timer',
  docs: 'https://docs.noodl.net/nodes/utilities/delay',
  displayName: 'Delay',
  category: 'Utilities',
  ssr: {
    compat: 'partial',
    note: 'The scheduler clock is frozen during server render, so Started/Finished never fire there; do not gate Page Ready on a Delay.'
  },
  nodeDoubleClickAction: {
    focusPort: 'duration'
  },
  initialize: function (this: TimerInstance) {
    const self = this;
    this._internal._animation = this.context.timerScheduler.createTimer({
      duration: 0,
      onStart: function () {
        self.sendSignalOnOutput('timerStarted');
      },
      onFinish: function () {
        self.sendSignalOnOutput('timerFinished');
      }
    }) as TimerInstance['_internal']['_animation'];

    this.addDeleteListener(() => {
      this._internal._animation.stop();
    });
  },
  getInspectInfo(this: TimerInstance) {
    if (this._internal._animation.isRunning()) {
      return Math.floor(this._internal._animation.durationLeft() / 10) / 100 + ' seconds';
    }
    return 'Not running';
  },
  inputs: {
    start: {
      group: 'Actions',
      displayName: 'Start',
      description: 'Starts the countdown, or fires Unchanged while one is already running — use Restart to begin again',
      valueChangedToTrue: function (this: TimerInstance) {
        const outcome = this.beginOutcome();
        // ERG-001 §4, §0.3's register. A `Start` on a running timer did nothing and said
        // nothing — and `Started` does not fire either, so there was no signal at all. Not a
        // failure: a countdown is running, which is what `Start` asked for.
        if (this._internal._animation._isRunning === false) {
          this._internal._animation.start();
          this.reportOutcome(outcome, 'done');
        } else {
          this.reportOutcome(outcome, 'unchanged');
        }
      }
    },
    restart: {
      group: 'Actions',
      displayName: 'Restart',
      description: 'Begins the countdown again from zero, whether or not one is already running',
      valueChangedToTrue: function (this: TimerInstance) {
        const outcome = this.beginOutcome();
        // Restart cannot no-op — it begins again whether or not one was running — which is the
        // whole difference between it and Start, and why only one of the two gets `Unchanged`.
        this._internal._animation.start();
        this.reportOutcome(outcome, 'done');
      }
    },
    duration: {
      group: 'Values',
      type: 'number',
      displayName: 'Duration',
      default: 0,
      description: 'How long the countdown runs before Finished fires, in milliseconds',
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.duration = value;
      }
    },
    startDelay: {
      group: 'Values',
      type: 'number',
      displayName: 'Start Delay',
      default: 0,
      description: 'How long to wait after Start before the countdown begins, in milliseconds',
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.delay = value;
      }
    },
    stop: {
      group: 'Actions',
      displayName: 'Stop',
      description: 'Abandons the countdown, so Finished never fires for it',
      valueChangedToTrue: function (this: TimerInstance) {
        const outcome = this.beginOutcome();
        const wasRunning = this._internal._animation._isRunning !== false;
        this._internal._animation.stop();
        this.reportOutcome(outcome, wasRunning ? 'done' : 'unchanged');
      }
    }
  },
  outputs: {
    timerStarted: {
      group: 'Events',
      type: 'signal',
      displayName: 'Started',
      description: 'Fires when the countdown begins, once Start Delay has elapsed'
    },
    timerFinished: {
      group: 'Events',
      type: 'signal',
      displayName: 'Finished',
      description: 'Fires once Duration has elapsed, and not at all for a countdown that was stopped'
    },

    /**
     * ERG-001 §4. Distinct from `Started` and `Finished`, which are about the *countdown*:
     * `Started` fires only after Start Delay elapses and `Finished` only when the countdown
     * runs out. These are about the invocation — exactly one per Start, Restart or Stop, the
     * moment it is handled.
     */
    ...outcomeOutputs({
      done: 'Fires when the action changed what the timer was doing',
      unchanged: 'Fires on a Start while one is already running, or a Stop with nothing running'
    })
  }
};

export default {
  node: Timer
};
