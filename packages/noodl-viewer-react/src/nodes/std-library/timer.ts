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
      valueChangedToTrue: function (this: TimerInstance) {
        if (this._internal._animation._isRunning === false) {
          this._internal._animation.start();
        }
      }
    },
    restart: {
      displayName: 'Restart',
      valueChangedToTrue: function (this: TimerInstance) {
        this._internal._animation.start();
      }
    },
    duration: {
      type: 'number',
      displayName: 'Duration',
      default: 0,
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.duration = value;
      }
    },
    startDelay: {
      type: 'number',
      displayName: 'Start Delay',
      default: 0,
      set: function (this: TimerInstance, value: number) {
        this._internal._animation.delay = value;
      }
    },
    stop: {
      displayName: 'Stop',
      valueChangedToTrue: function (this: TimerInstance) {
        this._internal._animation.stop();
      }
    }
  },
  outputs: {
    timerStarted: {
      type: 'signal',
      displayName: 'Started'
    },
    timerFinished: {
      type: 'signal',
      displayName: 'Finished'
    }
  }
};

export default {
  node: Timer
};
