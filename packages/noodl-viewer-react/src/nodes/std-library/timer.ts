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
      displayName: 'Start',
      description: 'Starts the countdown, and does nothing while one is already running — use Restart to begin again',
      valueChangedToTrue: function (this: TimerInstance) {
        if (this._internal._animation._isRunning === false) {
          this._internal._animation.start();
        }
      }
    },
    restart: {
      displayName: 'Restart',
      description: 'Begins the countdown again from zero, whether or not one is already running',
      valueChangedToTrue: function (this: TimerInstance) {
        this._internal._animation.start();
      }
    },
    duration: {
      type: 'number',
      displayName: 'Duration',
      default: 0,
      description: 'How long the countdown runs before Finished fires, in milliseconds',
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.duration = value;
      }
    },
    startDelay: {
      type: 'number',
      displayName: 'Start Delay',
      default: 0,
      description: 'How long to wait after Start before the countdown begins, in milliseconds',
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.delay = value;
      }
    },
    stop: {
      displayName: 'Stop',
      description: 'Abandons the countdown, so Finished never fires for it',
      valueChangedToTrue: function (this: TimerInstance) {
        this._internal._animation.stop();
      }
    }
  },
  outputs: {
    timerStarted: {
      type: 'signal',
      displayName: 'Started',
      description: 'Fires when the countdown begins, once Start Delay has elapsed'
    },
    timerFinished: {
      type: 'signal',
      displayName: 'Finished',
      description: 'Fires once Duration has elapsed, and not at all for a countdown that was stopped'
    }
  }
};

export default {
  node: Timer
};
