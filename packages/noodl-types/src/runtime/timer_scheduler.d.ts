/**
 * The frame-driven timer the runtime hands to node definitions as
 * `this.context.timerScheduler`.
 *
 * Every field here is checked against `packages/noodl-runtime/src/timerscheduler.js`.
 * The constructor copies each key of {@link TimerOptions} onto the timer verbatim
 * (`for (var arg in args) this[arg] = args[arg]`), so an option and a property of the
 * same name are the same slot — which is why `duration`, `delay` and `repeatCount`
 * appear in both interfaces and can be reassigned after the timer is created.
 */
export interface TimerOptions {
  /** Milliseconds. `0` means the timer completes on its first frame. */
  duration?: number;
  /** `0` is rewritten to `100000` by `scheduleTimer`, i.e. "effectively forever". */
  repeatCount?: number;
  /** Milliseconds to wait before the first frame. A delay of `0` runs one frame immediately. */
  delay?: number;

  /** Called once per run, on the first frame at or after `delay`. */
  onStart?: (this: Timer) => void;
  /**
   * Called when the timer runs to completion. Not called when {@link Timer.stop} ended it.
   *
   * Note the spelling: the scheduler calls `onFinish`, not `onFinished`. A callback passed
   * under any other name lands in the extra-properties slot below and is never invoked.
   */
  onFinish?: (this: Timer) => void;
  /** Called by `stopTimer` when a *running* timer is stopped before completing. */
  onStop?: (this: Timer) => void;
  /** Called every frame with the eased position within the current repeat, `0`–`1`. */
  onRunning?: (this: Timer, time: number) => void;

  /**
   * Anything else here is copied onto the timer and left alone.
   *
   * This is not laxity — it is the documented way to give a timer per-use state. The
   * animation nodes hang `startValue`, `endValue` and `ease` off their timer and read them
   * back through `this` inside `onRunning`, because the callbacks are invoked as methods.
   * Declare the extras on your own interface extending {@link Timer} to get them typed.
   */
  [extra: string]: unknown;
}

export interface Timer extends TimerOptions {
  scheduler: TimerScheduler;
  repeatCount: number;
  delay: number;
  duration: number;

  /** Restarts the timer if it is already running. Returns itself. */
  start(): Timer;
  stop(): void;
  isRunning(): boolean;
  /** Milliseconds left in the current run. Only meaningful while running. */
  durationLeft(): number;
}

export interface TimerScheduler {
  createTimer(args: TimerOptions): Timer;
  scheduleTimer(timer: Timer): void;
  stopTimer(timer: Timer): void;
  runTimers(currentTime: number): void;
  hasPendingTimers(): boolean;
}
