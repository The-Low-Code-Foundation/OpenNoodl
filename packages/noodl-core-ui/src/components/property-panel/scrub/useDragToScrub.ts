import React, { useEffect, useMemo, useRef } from 'react';

import { ScrubBinding, ScrubController, createScrubController } from './scrubController';

export interface DragToScrub {
  /**
   * Put this on the input.
   *
   * `undefined` when the row passed no binding, so a field that does not scrub gets no
   * handler at all rather than one that returns early — which is also what makes "this field
   * is not scrubbable" visible in a rendered element tree.
   */
  onMouseDown?: (event: React.MouseEvent) => void;
  /** Whether a drag is currently past the threshold, for cursor/affordance chrome. */
  isScrubbing: () => boolean;
}

/**
 * Drag-to-scrub for a numeric field.
 *
 * All of the behaviour is in {@link createScrubController}, which has no React and no real
 * DOM in it so that AC2 and AC5 can be graded rather than assumed — see that module's note.
 * This is the wiring: keep one controller for the life of the component, let it read the
 * current binding through a ref, and tear it down on unmount.
 *
 * 🔴 **It never blurs and never moves focus.** FB-016's transform-origin crosshair is drawn
 * while one of those two fields holds focus and is torn down on blur. A scrub that stole
 * focus — to stop text being selected, say — would drop the crosshair the moment the user
 * started dragging, losing the overlay exactly when it is being used as the feedback loop
 * this task was filed to complete. Selection is suppressed with `user-select` on the body
 * instead, which needs no focus change.
 *
 * 🔴 **Document listeners rather than `setPointerCapture`.** Capture on an `<input>` competes
 * with the browser's own text-selection drag and with focus, and it is released by a
 * re-render — and this panel re-renders on every committed parameter. Document listeners
 * bound for the life of the gesture see a mouseup anywhere on screen, which is what AC5 is
 * actually asking for.
 */
export function useDragToScrub(binding?: ScrubBinding): DragToScrub {
  // The controller reads the binding through this on every event, so a drag always writes
  // through the row as it is *now* rather than as it was when the press landed.
  const bindingRef = useRef<ScrubBinding | undefined>(binding);
  bindingRef.current = binding;

  const controller: ScrubController = useMemo(
    () =>
      createScrubController({
        getBinding: () => bindingRef.current,
        getDocument: () => (typeof document === 'undefined' ? null : document)
      }),
    []
  );

  // AC5, the half a mouseup cannot cover: this panel rebuilds itself on parameter changes and
  // on undo, so the row under the cursor can be unmounted while the button is still down.
  useEffect(() => () => controller.dispose(), [controller]);

  return {
    onMouseDown: binding ? (event: React.MouseEvent) => controller.onMouseDown(event) : undefined,
    isScrubbing: controller.isScrubbing
  };
}
