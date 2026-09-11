/**
 * FB-022 — the listener half of drag-to-scrub, with no React and no real DOM in it.
 *
 * ## Why this is not just the body of `useDragToScrub`
 *
 * Two of this task's acceptance criteria are about what happens *around* the arithmetic, not
 * inside it: AC2 is "a press that does not move still focuses the field and writes nothing",
 * and AC5 is "the drag is released when the button comes up, including outside the panel".
 * Both are claims about listener bookkeeping, and both are exactly the kind of thing that is
 * assumed rather than checked — a stuck drag is invisible until someone reproduces it.
 *
 * With the bookkeeping inside a hook they would be ungradeable here: this repo's plain-Node
 * runner has no dispatcher, so a hook throws, and `jest-environment-jsdom` is not installed.
 * So the controller takes its document as an argument. A spec hands it a few lines of fake,
 * feeds it events, and can then assert the things that actually go wrong — that no handler
 * survives a mouseup, that a two-pixel press writes nothing, that `dispose` mid-gesture
 * leaves nothing attached. {@link useDragToScrub} is the ten lines of refs on top.
 */
import { ScrubGesture, beginScrubGesture, scrubAt } from './scrubGesture';

/** The bit of a mouse event a scrub reads. Satisfied by a real `MouseEvent` and by React's. */
export interface ScrubPointerEvent {
  clientX: number;
  button?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: () => void;
}

/** The bit of `document` a scrub touches. Satisfied by a real one. */
export interface ScrubDocument {
  addEventListener(type: string, handler: (event: never) => void): void;
  removeEventListener(type: string, handler: (event: never) => void): void;
  body?: { style: { userSelect: string; cursor: string } } | null;
}

/**
 * What a row hands the field so its number can be dragged.
 *
 * The row builds this from the **port type**, never from a list of field names — see
 * `propertyeditor/DataTypes/scrubPolicy.ts`. A field with no binding is an ordinary field and
 * behaves exactly as it did before this task.
 */
export interface ScrubBinding {
  /** Units of value per pixel of horizontal travel, before modifiers. */
  step: number;
  /**
   * The number a gesture starts from.
   *
   * ⚠️ The *resolved* value, not the field's text: a field showing nothing is inheriting a
   * default, and a scrub that started such a field at 0 would jump the element before moving
   * it. The row resolves it, because the row is the only thing that knows the port's default.
   */
  value: number;
  /**
   * The press has become a drag.
   *
   * ⚠️ Fired when the threshold is crossed, **not** on mousedown. A click must leave no trace
   * at all, and a row that snapshotted its parameter on every press would be doing work — and
   * holding a stale snapshot — for every click that merely focuses a field.
   */
  onScrubBegin?: () => void;
  /** Live write during the drag. 🔴 Must NOT record undo — see {@link onScrubEnd}. */
  onScrub: (value: number) => void;
  /**
   * The gesture is over and `value` is where it ended.
   *
   * The row records **one** undo entry here covering the whole drag, which is why
   * {@link onScrub} records none: one entry per pixel would bury every other action in the
   * history and make a single ctrl-Z do nothing visible.
   *
   * `startValue` is the number the field held at the press.
   */
  onScrubEnd: (value: number, startValue: number) => void;
}

export interface ScrubController {
  /** Call from the field's `mousedown`. */
  onMouseDown(event: ScrubPointerEvent): void;
  /** Whether a gesture is currently past the threshold. */
  isScrubbing(): boolean;
  /** Detach anything still attached. Idempotent. */
  dispose(): void;
}

export interface ScrubControllerArgs {
  /**
   * The current binding, read fresh on every event.
   *
   * 🔴 A getter rather than a value, and that is load-bearing. The row re-renders after every
   * live write, so a binding captured at mousedown is stale by the second mousemove — and the
   * version that captured it wrote the whole drag through the row as it was *before* the drag
   * started.
   */
  getBinding: () => ScrubBinding | undefined;
  getDocument: () => ScrubDocument | null;
}

export function createScrubController({ getBinding, getDocument }: ScrubControllerArgs): ScrubController {
  let gesture: ScrubGesture | null = null;
  let detach: (() => void) | null = null;

  function release() {
    detach?.();
    detach = null;
    gesture = null;
  }

  function onMouseDown(event: ScrubPointerEvent) {
    // Left button only. A right-click opens the context menu and a middle-click pastes on
    // some platforms; neither should silently become an edit.
    if (event.button !== undefined && event.button !== 0) return;

    const binding = getBinding();
    const doc = getDocument();
    if (!binding || !doc) return;

    // 🔴 No `preventDefault` on the press, ever. That call is what would break AC2:
    // suppressing the default is what stops the browser focusing the input, so a plain click
    // would no longer enter edit mode and the field would become drag-only. The press is
    // allowed to focus as it always did, and the gesture decides what it was from movement.

    release();
    gesture = beginScrubGesture({ startValue: binding.value, originX: event.clientX, step: binding.step });

    const body = doc.body ?? null;
    const restoreUserSelect = body ? body.style.userSelect : '';
    const restoreCursor = body ? body.style.cursor : '';

    function restoreBody() {
      if (!body) return;
      body.style.userSelect = restoreUserSelect;
      body.style.cursor = restoreCursor;
    }

    function onMouseMove(moveEvent: ScrubPointerEvent) {
      const active = getBinding();
      if (!gesture || !active) return;

      const wasMoving = gesture.moved;
      const sample = scrubAt(gesture, moveEvent.clientX, moveEvent);
      if (!sample.moved) return;

      if (!wasMoving) {
        // Only once the press has become a drag. Either of these on mousedown would act on a
        // press that is still allowed to turn out to be a click.
        active.onScrubBegin?.();
        if (body) {
          body.style.userSelect = 'none';
          body.style.cursor = 'ew-resize';
        }
      }
      // Stops the drag painting a text selection across the panel. Safe here in a way it is
      // not on mousedown: by this point the gesture is definitely not a click.
      moveEvent.preventDefault?.();
      active.onScrub(sample.value);
    }

    function onMouseUp(upEvent: ScrubPointerEvent) {
      const finished = gesture;
      const active = getBinding();
      // 🔴 Released FIRST, before anything that can throw. AC5 is a stuck drag, and the way a
      // drag gets stuck is a handler that fails on its way to the line that would have
      // detached it — after which every mousemove on the page is still writing parameters.
      release();
      restoreBody();
      if (!finished || !active || !finished.moved) return; // Not a drag: the browser focused it.

      const sample = scrubAt(finished, upEvent.clientX, upEvent);
      // ⚠️ The start value is the one captured at the press, not whatever the model holds now:
      // the drag has been writing continuously *without* undo, so by this point the model
      // already contains the dragged value and an undo built from it would restore the end of
      // the drag rather than reverse it. Same trap `MarginPaddingInput` records.
      active.onScrubEnd(sample.value, finished.startValue);
      // A completed drag must not also count as a click on the way up — without this the
      // field takes the caret too, which reads as the value being about to be retyped.
      upEvent.preventDefault?.();
    }

    doc.addEventListener('mousemove', onMouseMove as (event: never) => void);
    doc.addEventListener('mouseup', onMouseUp as (event: never) => void);
    detach = () => {
      doc.removeEventListener('mousemove', onMouseMove as (event: never) => void);
      doc.removeEventListener('mouseup', onMouseUp as (event: never) => void);
      restoreBody();
    };
  }

  return {
    onMouseDown,
    isScrubbing: () => Boolean(gesture?.moved),
    dispose: release
  };
}
