import type { ReactNodeInstance } from '../../../react-component-node';

/** Timing block every transition carries; `curve` is only read by the eased subclasses. */
export interface TransitionTiming {
  dur: number;
  delay: number;
  curve?: number[];
}

/**
 * The `tr-…` parameters a Push Component To Stack node collects for its transition,
 * plus `type`. Values come straight from editor inputs, so the shapes are loose on
 * purpose — `shift`/`zoom` accept both the unit object and a bare number.
 */
export interface TransitionParams {
  timing?: TransitionTiming;
  shift?: number | { value: number; unit: string };
  zoom?: number | { value: number; unit: string };
  direction?: string;
  crossfade?: boolean;
  darkoverlay?: boolean;
  darkoverlayamount?: number;
  fadein?: boolean;
  [extra: string]: unknown;
}

export interface TransitionStartArgs {
  end?: () => void;
  back?: boolean;
}

/**
 * What the `Transitions` registry holds: a subclass constructor plus its static
 * `ports`, which the Push Component To Stack node's `setup` calls to publish the
 * transition's `tr-…` editor ports. `NoneTransition.ports` ignores the argument.
 */
export interface TransitionConstructor {
  new (from: ReactNodeInstance, to: ReactNodeInstance, params: TransitionParams): Transition;
  ports(parameters: Record<string, unknown>): unknown[];
}

/**
 * `window.performance` dereferences window, which does not exist server-side —
 * and a navigation during an SSR render does start transitions. There the
 * animation is pointless anyway, so start() completes immediately instead.
 */
const hasAnimationClock = () => typeof window !== 'undefined' && !!window.performance;

abstract class Transition {
  _frame: () => void;
  cb?: () => void;
  timing: TransitionTiming;
  transitionForward?: boolean;
  startTime?: number;

  constructor() {
    this._frame = this.frame.bind(this);
  }

  start(args: TransitionStartArgs) {
    this.cb = args.end;

    if (this.timing.delay + this.timing.dur === 0 || !hasAnimationClock()) {
      this.end();
    } else {
      this.transitionForward = !args.back;
      this.startTime = window.performance.now();
      requestAnimationFrame(this._frame);
    }
  }

  frame() {
    const t = (window.performance.now() - (this.startTime + this.timing.delay)) / this.timing.dur;
    const _t = Math.max(0, Math.min(t, 1));

    this.transitionForward ? this.forward(_t) : this.back(_t);

    if (window.performance.now() <= this.startTime + this.timing.dur + this.timing.delay)
      requestAnimationFrame(this._frame);
    else this.end();
  }

  end() {
    this.cb && this.cb();
  }

  abstract forward(t: number): void;
  abstract back(t: number): void;
  abstract update(t: number): void;
}

export default Transition;
