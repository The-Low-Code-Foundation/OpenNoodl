'use strict';

import type { Timer as PublishedTimer, TimerOptions, TimerScheduler as PublishedScheduler } from '@noodl/types';

/**
 * The frame-driven timer behind `context.timerScheduler`.
 *
 * The published contract is {@link PublishedTimer} / {@link PublishedScheduler} in
 * `@noodl/types` — written against this file and checked line by line. What is added here
 * is only the private bookkeeping the scheduler keeps on each timer, which node authors
 * neither set nor read.
 */
interface TimerInternals {
  /** Frame time at which this run began, i.e. `currentTime + delay` when it was queued. */
  _start?: number;
  _durationLeft?: number;
  _isRunning: boolean;
  _hasCalledOnStart: boolean;
  /** Set by {@link Timer.stop} and read by `runTimers` to suppress `onFinish`. */
  _wasStopped?: boolean;
}

interface Timer extends PublishedTimer, TimerInternals {}

/**
 * `args` is copied key-by-key onto the timer, so an option and a property of the same name
 * are the same slot. That is why `duration`/`delay`/`repeatCount` are assigned first: the
 * loop below is allowed to overwrite them.
 */
function Timer(this: Timer, scheduler: TimerScheduler, args: TimerOptions) {
  this.duration = args.duration || 0;
  this._isRunning = false;
  this._hasCalledOnStart = false;
  this.scheduler = scheduler;
  this.repeatCount = 1;
  this.delay = 0;

  for (const arg in args) {
    this[arg] = args[arg];
  }
}

Timer.prototype.start = function (this: Timer): Timer {
  if (this._isRunning) {
    this.stop();
  }

  this.scheduler.scheduleTimer(this);
  return this;
};

Timer.prototype.stop = function (this: Timer): void {
  this.scheduler.stopTimer(this);
  this._hasCalledOnStart = false;
  this._isRunning = false;
  this._wasStopped = true; // This is used to avoid calling onFinish
};

Timer.prototype.isRunning = function (this: Timer): boolean {
  return this._isRunning;
};

Timer.prototype.durationLeft = function (this: Timer): number {
  return this._durationLeft;
};

interface TimerScheduler extends PublishedScheduler {
  /** Asks the host for another animation frame. Supplied by whoever built the scheduler. */
  requestFrame(): void;
  runningTimers: Timer[];
  /** Queued but not yet started — they join `runningTimers` at the end of the next frame. */
  newTimers: Timer[];
}

function TimerScheduler(this: TimerScheduler, requestFrameCallback: () => void) {
  this.requestFrame = requestFrameCallback;
  this.runningTimers = [];
  this.newTimers = [];
}

TimerScheduler.prototype.createTimer = function (this: TimerScheduler, args: TimerOptions): Timer {
  return new (Timer as unknown as { new (scheduler: TimerScheduler, args: TimerOptions): Timer })(this, args);
};

TimerScheduler.prototype.scheduleTimer = function (this: TimerScheduler, timer: Timer): void {
  if (this.newTimers.indexOf(timer) === -1) {
    if (timer.repeatCount === 0) {
      timer.repeatCount = 100000;
    }

    this.newTimers.push(timer);
    this.requestFrame();
  }
};

TimerScheduler.prototype.stopTimer = function (this: TimerScheduler, timer: Timer): void {
  let index: number;

  if (timer._isRunning) {
    index = this.runningTimers.indexOf(timer);
    if (index !== -1) {
      this.runningTimers.splice(index, 1);
    }

    if (timer.onStop && !timer._wasStopped) {
      timer.onStop();
    }
  } else {
    index = this.newTimers.indexOf(timer);
    if (index !== -1) {
      this.newTimers.splice(index, 1);
    }
  }
};

TimerScheduler.prototype.runTimers = function (this: TimerScheduler, currentTime: number): void {
  const remainingTimers: Timer[] = [],
    finishedTimers: Timer[] = [],
    timersThisFrame: Timer[] = [];

  let i: number,
    timer: Timer;
  const len = this.runningTimers.length;

  //copy timer list in case timers are added or removed during onStart or onRunning
  for (i = 0; i < len; ++i) {
    timersThisFrame[i] = this.runningTimers[i];
  }

  for (i = 0; i < len; ++i) {
    timer = timersThisFrame[i];
    if (timer && currentTime >= timer._start) {
      if (timer._hasCalledOnStart === false && timer.onStart) {
        timer.onStart();
        timer._hasCalledOnStart = true;
      }

      let t: number;
      if (timer.duration > 0) {
        t = (currentTime - timer._start) / (timer.duration * timer.repeatCount);
      } else {
        t = 1.0;
      }

      timer._durationLeft = timer.duration * (1 - t);

      let localT = t * timer.repeatCount - Math.floor(t * timer.repeatCount);
      if (t >= 1.0) {
        localT = 1.0;
      }

      if (timer.onRunning) {
        timer.onRunning(localT);
      }

      if (t < 1.0 && timer._isRunning) {
        remainingTimers.push(timer);
      } else if (!timer._wasStopped) {
        finishedTimers.push(timer);
      }
    } else {
      remainingTimers.push(timer);
    }
  }

  this.runningTimers = remainingTimers;

  for (i = 0; i < finishedTimers.length; ++i) {
    finishedTimers[i]._isRunning = false;
    finishedTimers[i]._hasCalledOnStart = false;
    if (finishedTimers[i].onFinish) {
      finishedTimers[i].onFinish();
    }
  }

  //add newly queued timers
  if (this.newTimers.length > 0) {
    for (i = 0; i < this.newTimers.length; ++i) {
      timer = this.newTimers[i];
      timer._start = currentTime + timer.delay;
      timer._isRunning = true;
      timer._wasStopped = false;
      this.runningTimers.push(timer);

      if (timer.delay === 0) {
        //play first timer frame directly to keep everything nicely synched
        if (timer.onStart) {
          timer.onStart();
          timer._hasCalledOnStart = true;
        }
        if (timer.onRunning) {
          timer.onRunning(0);
        }
      }
    }
    this.newTimers.length = 0;
  }
};

TimerScheduler.prototype.hasPendingTimers = function (this: TimerScheduler): boolean {
  return this.runningTimers.length > 0 || this.newTimers.length > 0;
};

export = TimerScheduler;
