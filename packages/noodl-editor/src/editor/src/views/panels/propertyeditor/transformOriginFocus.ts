import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

/**
 * FB-016 scope 4 — the one fact the viewer cannot work out for itself.
 *
 * The box-model overlay reads everything it says off the DOM it is already drawing over. The
 * transform-origin crosshair cannot: its trigger is *"while the transform-origin field has
 * focus"*, and focus lives in the editor's properties panel, in a different process from the
 * document the crosshair is drawn on. So it is pushed — and this module is the whole of the
 * editor's side of that push, kept free of React and Electron so it can be graded directly.
 */

/** Carries a boolean: whether any transform-origin field currently holds focus. */
export const TRANSFORM_ORIGIN_FOCUS_EVENT = 'transform-origin-focus';

/**
 * The ports the crosshair explains.
 *
 * ⚠️ **There are two of them, not one.** `transform-origin` is a single CSS declaration but the
 * panel splits it across `Transform Origin X` and `Transform Origin Y`
 * (`node-shared-port-definitions.ts`), and an author setting an origin almost always tabs from one
 * to the other. A tracker that treated either field as "the" field would drop the crosshair
 * halfway through the gesture it exists to support.
 */
export function isTransformOriginPort(portName: string): boolean {
  return portName === 'transformOriginX' || portName === 'transformOriginY';
}

type Schedule = (callback: () => void) => unknown;
type Cancel = (handle: unknown) => void;

/**
 * Turns per-field focus and blur into one "is the author editing the origin" boolean.
 *
 * 🔴 **Tabbing from X to Y emits nothing, and that is the reason this is a class and not two
 * callbacks.** The DOM fires `blur` on the field being left *before* `focus` on the field being
 * entered, so the naive relay sends `false` and then `true` for a gesture in which the answer
 * never changed — and the crosshair blinks off and on under the author's hand at the exact moment
 * they are looking at it. Turning **off** is therefore deferred by one turn of the scheduler and
 * cancelled if focus lands on the sibling field; turning **on** is immediate, because a delay
 * there is a delay in answering the question.
 *
 * ⚠️ **`release` exists because a blur is not guaranteed.** React does not fire `blur` when it
 * unmounts a focused input, so a panel rebuilt under the author's cursor — a different node
 * selected, the tier switched — would leave this stuck on and the crosshair painted over an
 * element nobody is editing. Every field that registers a focus must hand it back on dispose.
 */
export class TransformOriginFocusTracker {
  private focused: string[] = [];
  private on = false;
  private pendingOff: unknown = null;

  constructor(
    private readonly emit: (enabled: boolean) => void,
    private readonly schedule: Schedule = (callback) => setTimeout(callback, 0),
    private readonly cancel: Cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
  ) {}

  get isOn(): boolean {
    return this.on;
  }

  focus(portName: string): void {
    if (!isTransformOriginPort(portName)) return;

    if (this.focused.indexOf(portName) === -1) {
      this.focused.push(portName);
    }
    this.clearPendingOff();

    if (!this.on) {
      this.on = true;
      this.emit(true);
    }
  }

  blur(portName: string): void {
    this.release(portName);
  }

  release(portName: string): void {
    const at = this.focused.indexOf(portName);
    if (at !== -1) {
      this.focused.splice(at, 1);
    }

    if (this.focused.length || !this.on || this.pendingOff !== null) return;

    this.pendingOff = this.schedule(() => {
      this.pendingOff = null;
      // Focus may have landed on the sibling field in the meantime, which is the whole point.
      if (this.focused.length || !this.on) return;
      this.on = false;
      this.emit(false);
    });
  }

  /** Drops the crosshair now, whatever is focused — for a selection change, which rebuilds the panel. */
  reset(): void {
    this.focused = [];
    this.clearPendingOff();
    if (this.on) {
      this.on = false;
      this.emit(false);
    }
  }

  private clearPendingOff(): void {
    if (this.pendingOff !== null) {
      this.cancel(this.pendingOff);
      this.pendingOff = null;
    }
  }
}

/** The panel's single tracker: the fields are many, the answer is one boolean. */
export const transformOriginFocus = new TransformOriginFocusTracker((enabled) =>
  EventDispatcher.instance.emit(TRANSFORM_ORIGIN_FOCUS_EVENT, enabled)
);
